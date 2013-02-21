(function (window) {
	var requestId = 1;

	/**
	 * Request class
	 *
	 * @param url
	 * @param protocolVersion
	 * @param user
	 * @param password
	 * @param methodName
	 * @param {Array} data
	 * @param {boolean} isNotification
	 *
	 * @return JsonRPCRequest
	 */
	function JsonRPCRequest(url, protocolVersion, user, password, methodName, data, isNotification) {
		// TODO: Should I improve validation of params?
		if (data != undefined && !(data instanceof Object)) {
			throw 'The parameters for the ' + methodName + '() must be passed as an array or an object; the value you supplied (' + String(data) + ') is of type "' + typeof(data) + '".';
		}

		this._url             = url;
		this._protocolVersion = protocolVersion;
		this._authUserName    = user;
		this._authPassword    = password;
		this._isNotification  = isNotification;

		// prepare request
		this._request = {
			jsonrpc: this._protocolVersion,
			method: methodName
		};
		if (data != undefined) {
			this._request.params = data;
		}
		if (!this._isNotification) {
			this._request.id = requestId++;
		}

		return this;
	}

	JsonRPCRequest.prototype.successHandler   = function() {};
	JsonRPCRequest.prototype.exceptionHandler = function() {};
	JsonRPCRequest.prototype.completeHandler  = function() {};

	/**
	 * Add success callback to the request;
	 * Callback will gets result-object from response
	 *
	 * @param callback
	 *
	 * @return JsonRPCRequest
	 */
	JsonRPCRequest.prototype.onSuccess = function(callback) {
		if (callback) {
			if (typeof callback != 'function') {
				throw 'The onSuccess handler callback function you provided is invalid; the value you provided (' + callback.toString() + ') is of type "' + typeof(callback) + '".';
			}

			if (!this._isNotification) {
				this.successHandler = callback;
			}
		}
		return this;
	};

	/**
	 * Add exception callback to the request;
	 * Callback will gets error-object or string;
	 *
	 * @param callback
	 *
	 * @return JsonRPCRequest
	 */
	JsonRPCRequest.prototype.onException = function(callback) {
		if (callback) {
			if (typeof callback != 'function') {
				throw 'The onException handler callback function you provided is invalid; the value you provided (' + callback.toString() + ') is of type "' + typeof(callback) + '".';
			}

			if (!this._isNotification) {
				this.exceptionHandler = callback;
			}
		}

		return this;
	};

	/**
	 * Add callback to the request, it will be called when response will be got (independently on result of request);
	 * Callback doesn`t gets any parameters;
	 *
	 * @param callback
	 *
	 * @return JsonRPCRequest
	 */
	JsonRPCRequest.prototype.onComplete = function(callback) {
		if (callback) {
			if (typeof callback != 'function') {
				throw 'The onComplete handler callback function you provided is invalid; the value you provided (' + callback.toString() + ') is of type "' + typeof(callback) + '".';
			}

			if (!this._isNotification) {
				this.completeHandler = callback;
			}
		}

		return this;
	};

	/**
	 * Send the request
	 */
	JsonRPCRequest.prototype.execute = function() {
		doRequest(this._url, this._authUserName, this._authPassword, this._request, (function(requestInstance) {
			return function(response) {
				handleRequestResponse(requestInstance, response.code, response.message);
			}
		})(this));
	};

	function handleRequestResponse (request, responseCode, responseMessage) {
		if (responseCode == 200 && responseMessage == '' && request._isNotification) {
			return;
		}

		if (responseCode == 200 && responseMessage.hasOwnProperty('result')) {
			request.successHandler(responseMessage.result);
		} else if (responseCode != 200 || responseMessage.hasOwnProperty('error')) {
			var exception = {};
			if (responseCode != 200) {
				exception.code    = responseCode;
				exception.message = responseMessage;
			} else {
				exception = responseMessage.error;
			}

			request.exceptionHandler(exception);
		} else {
			throw 'The JSON RPC response "' + JSON.stringify({code: responseCode, message: responseMessage}) + '" hasn`t properties "result" and "error".';
		}

		request.completeHandler();
	}


	/**
	 * Batch class
	 *
	 * @param url
	 * @param protocolVersion
	 * @param user
	 * @param password
	 *
	 * @return JsonRPCBatch
	 */
	function JsonRPCBatch(url, protocolVersion, user, password) {
		this._url               = url;
		this._protocolVersion   = protocolVersion;
		this._authUserName      = user;
		this._authPassword      = password;

		this._requests = [];
		this._objects  = {};

		return this;
	}

	/**
	 * Add request to the batch
	 *
	 * @param {JsonRPCRequest} requestObj
	 *
	 * @return JsonRPCBatch
	 */
	JsonRPCBatch.prototype.addRequest = function(requestObj) {
		if (!(requestObj instanceof JsonRPCRequest)) {
			throw 'The parameter for addRequest() must be instance of JsonRPCRequest; the value you provided (' + String(requestObj) + ') is of type "' + typeof(requestObj) + '".';
		}

		var body = requestObj._request;

		this._requests[this._requests.length] = body;

		if (!requestObj._isNotification) {
			this._objects[body.id] = requestObj;
		}

		return this;
	};

	/**
	 * Add several request to the batch simultaneously
	 *
	 * @param {JsonRPCRequest[]} requestsArr
	 *
	 * @return JsonRPCBatch
	 */
	JsonRPCBatch.prototype.addRequests = function(requestsArr) {
		if (!(requestsArr instanceof Array)) {
			throw 'The parameter for the addRequests() must be passed as an array; the value you supplied (' + String(requestsArr) + ') is of type "' + typeof(requestsArr) + '".';
		}

		for (var i = 0; i < requestsArr.length; i++) {
			this.addRequest(requestsArr[i]);
		}

		return this;
	};

	JsonRPCBatch.prototype.exceptionHandler = function() {};

	JsonRPCBatch.prototype.onException = function(callback) {
		if (callback) {
			if (typeof(callback) != 'function') {
				throw 'The onException handler callback function you provided is invalid; the value you provided (' + callback.toString() + ') is of type "' + typeof(callback) + '".';
			}

			this.exceptionHandler = callback;
		}
	};

	/**
	 * Send the batch
	 */
	JsonRPCBatch.prototype.execute = function() {
		doRequest(this._url, this._authUserName, this._authPassword, this._requests, (function(batchInstance) {
			return function(response) {
				handleBatchResponse(batchInstance, response.code, response.message);
			}
		})(this));
	};

	function handleBatchResponse(batch, responseCode, responseMessage) {
		var errorCode;
		var id;
		var index;
		if (responseCode == 200) {
			// Each request in the batch was sent as notification
			if (responseMessage == '' && Object.keys(batch._objects).length == 0) {
				return;
			} else if (responseMessage == '') {
				// Server returned empty response. Object or Array was expected
				errorCode    = 500;

				// If batch got valid json Response
				// If responseMessage is Array
			} else if (responseMessage instanceof Array) {
				var isErrorExists = false;
				// Check responseMessage for all requests have a response
				for (id in batch._objects) {
					if (batch._objects.hasOwnProperty(id)) {
						var isResponseExists = false;
						for (index in responseMessage) {
							if (responseMessage.hasOwnProperty(index) && responseMessage[index].hasOwnProperty('id') && responseMessage[index].id == id) {
								isResponseExists = true;
								break;
							}
						}
						if (!isResponseExists) {
							// Response for some request wasn`t returned
							errorCode     = -32001;
							isErrorExists = true;
						}
					}
				}

				// Search errors in each Response object
				for (index in responseMessage) {
					if (responseMessage.hasOwnProperty(index) && responseMessage[index].hasOwnProperty('error')) {
						if (!isErrorExists) {
							// Some request got error as response
							errorCode = -32002;
						} else {
							errorCode = -32003;
						}
					}
				}

				// If batch got valid json Response
				// If responseMessage is an Object - single Response object
			} else {
				if (responseMessage.hasOwnProperty('error') && responseMessage.error.code == -32700) {
					// Parse error
					errorCode = responseMessage.error.code;
				} else {
					if (Object.keys(batch._objects).length > 1) {
						errorCode = -32001; // Response for some request wasn`t returned
					}

					if (responseMessage.hasOwnProperty('error') && errorCode == undefined) {
						errorCode = -32002; // Some request got error as response
					} else if (responseMessage.hasOwnProperty('error')) {
						errorCode = -32003;
					}
				}
			}
		} else {
			errorCode = responseCode;
		}

		if (errorCode != undefined && !batch.exceptionHandler({code: errorCode, message: responseMessage})) {
			return;
		}

		var responses = [];
		if (errorCode == undefined) {
			responses = responseMessage;
		} else {
			// Parse error
			if (errorCode == -32700) {
				for (id in batch._objects) {
					if (batch._objects.hasOwnProperty(id)) {
						responses.push({
							'jsonrpc': batch._objects[id]._request.jsonrpc,
							'id': id,
							'error': {
								'code': errorCode,
								'message': 'Parse error occurred.',
								'data': null
							}
						});
					}
				}

				// HTTP error occurred
			} else if (errorCode > -32000) {
				for (id in batch._objects) {
					if (batch._objects.hasOwnProperty(id)) {
						responses.push({
							'id': id,
							'message': 'Http error occured.'
						});
					}
				}

				// If some request didn`t get response
			} else if (errorCode >= -32003 || errorCode <= -32001) {
				if (!(responseMessage instanceof Array)) {
					responseMessage = [responseMessage];
				}
				for (id in batch._objects) {
					if (batch._objects.hasOwnProperty(id)) {
						var responseExists = false;
						for (index in responseMessage) {
							if (responseMessage.hasOwnProperty(index)) {
								if (responseMessage[index].hasOwnProperty('id') && responseMessage[index].id == id) {
									responses.push(responseMessage[index]);
									responseExists = true;
								}
							}
						}
						if (!responseExists) {
							responses.push({
								'jsonrpc': batch._objects[id]._request.jsonrpc,
								'id': id,
								'error': {
									'code': -32001,
									'message': 'This request didn`t got response.',
									'data': null
								}
							});
						}
					}
				}
			}
		}

		for (index in responses) {
			if (responses.hasOwnProperty(index)) {
				handleRequestResponse(batch._objects[responses[index].id], responseCode, responses[index]);
			}
		}
	}


	function JsonRPC(url, options) {
		if (!(options instanceof Object)) {
			throw 'The options for the initialization must be passed as an array or an object; the value you supplied (' + String(options) + ') is of type "' + typeof(options) + '".';
		}
		if (!(options.methods instanceof Object)) {
			throw 'The options.methods for the initialization must be passed as an array or an object; the value you supplied (' + String(options.methods) + ') is of type "' + typeof(options.methods) + '".';
		}

		this._protocolVersion = '2.0';
		this._requestURL      = url;
		this._authUsername    = options.user != undefined ? options.user : null;
		this._authPassword    = options.password != undefined ? options.password : null;
		this._methodsList     = options.methods[0] instanceof Object ? options.methods : [options.methods];

		for (var i = 0; i < this._methodsList.length; i++) {
			var methodObject = this;

			if (this._methodsList[i][0] == undefined || typeof(this._methodsList[i][0]) != 'string') {
				throw 'The method name must be a string; the value you supplied (' + String(this._methodsList[i][0]) + ') is of type "' + typeof(this._methodsList[i][0]) + '".';
			}
			var methodName = this._methodsList[i][0];

			if (this._methodsList[i][1] != undefined && typeof(this._methodsList[i][1]) != 'boolean') {
				throw 'The "is notification" flag must be a boolean; the value you supplied (' + String(this._methodsList[i][1]) + ') is of type "' + typeof(this._methodsList[i][1]) + '".';
			}
			var isNotification = this._methodsList[i][1] != undefined ? this._methodsList[i][1] : false;

			var propChain = methodName.split('.');

			var j = 0;
			for (; j < propChain.length - 1; j++) {
				if (!methodObject[propChain[j]]) {
					methodObject[propChain[j]] = {};
				}
				methodObject = methodObject[propChain[j]];
			}

			methodObject[propChain[j]] = (function(instance, methodName, isNotification) {
				return function(params) {
					return new JsonRPCRequest(instance._requestURL, instance._protocolVersion, instance._authUsername, instance._authPassword, methodName, params, isNotification);
				};
			})(this, methodName, isNotification);
		}
	}

	JsonRPC.prototype.batchRequest = function() {
		return new JsonRPCBatch(this._requestURL, this._protocolVersion, this._authUsername, this._authPassword);
	};

	function doRequest(url, authUserName, authPassword, request, callback) {
		var xhr = new XMLHttpRequest();
		xhr.open('POST', url, true, authUserName, authPassword);
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.setRequestHeader('Accept', 'application/json');

		xhr.onreadystatechange = function() {
			if (xhr.readyState == 4) {
				var message;
				var code;
				if (xhr.status != 200) {
					code    = xhr.status;
					message = xhr.statusText;
				} else {
					try {
						code = xhr.status;
						if (xhr.responseText != '') {
							message = JSON.parse(xhr.responseText);
						} else {
							message = xhr.responseText;
						}
					} catch (e) {
						code    = 500;
						message = xhr.responseText;
					}
				}
				callback({code: code, message: message});
			}
		};

		xhr.send(JSON.stringify(request));
	}

	window.JsonRPC = JsonRPC;
})(window);
