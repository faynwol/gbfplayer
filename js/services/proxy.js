var http = require("http");
var net = require("net");
var url = require("url");
var zlib = require('zlib');
var AppDispatcher = require("../dispatcher/AppDispatcher");
var port ;
var _webContents;

function MiniProxy() {
    this.port = 9393;
    this.onServerError = function() {};
    this.onBeforeRequest = function(req) {
        _webContents.send('HTTPData', 'req', req);
    };
    this.onBeforeResponse = function(res) {
        _webContents.send('HTTPData', 'res', res);
    };
    this.onRequestError = function() {};
}
MiniProxy.prototype.start = function() {
    var server = http.createServer();

    server.on("request", this.requestHandler);
    server.on("connect", this.connectHandler);

    server.on("error", this.onServerError);
    server.on("beforeRequest", this.onBeforeRequest);
    server.on("beforeResponse", this.onBeforeResponse);
    server.on("requestError", this.onRequestError);

    server.listen(this.port);
    port = this.port;
}

MiniProxy.prototype.requestHandler = function(req, res) {
    try {
        
        var self = this; // this -> server
        var path = req.headers.path || url.parse(req.url).path;
        var requestOptions = {
            host: req.headers.host.split(':')[0],
            port: req.headers.host.split(':')[1] || 80,
            path: path,
            method: req.method,
            headers: req.headers
        };

        //check url
        if (requestOptions.host == "127.0.0.1" && requestOptions.port == port) {
            res.writeHead(200, {
                'Content-Type': 'text/plain'
            });
            res.write("ok");
            res.end();
            return;
        }

        var reqObj = {};
        Object.assign(reqObj, requestOptions);
        var body = '';      
        req.on('data',function(chunk){  
            body += chunk;  
        });   
        req.on('end',function(){  
            reqObj.body = body;
            self.emit("beforeRequest", reqObj);
        });

        //u can change request param here
        requestRemote(requestOptions, req, res, self);

    } catch (e) {
        console.log("requestHandlerError" + e.message);
    }
    
    function requestRemote(requestOptions, req, res, proxy) {
        var remoteRequest = http.request(requestOptions, function(remoteResponse) {

            // write out headers to handle redirects
            res.writeHead(remoteResponse.statusCode, '', remoteResponse.headers);

            var resObj = {
                'headers': remoteResponse.headers,
                'content-type': remoteResponse.headers['content-type'],
                'statusCode': remoteResponse.statusCode,
                'host': remoteResponse.socket._host,
                'path': remoteResponse.socket._httpMessage.path,
                'httpMessage': remoteResponse.socket._httpMessage
            };

            if(remoteResponse.headers['content-type'] && remoteResponse.headers['content-type'].indexOf('json') !== -1) {

                var body = [];
                remoteResponse.on('data',function(chunk){  
                    body.push(chunk);  
                });   
                remoteResponse.on('end',function(){
                    var buffer = Buffer.concat(body);
                    if(remoteResponse.headers['content-encoding'].indexOf('gzip') !== -1) {
                        zlib.gunzip(buffer, function(err, dezipped) {
                            try{
                                resObj.body = JSON.parse(dezipped.toString('utf-8'));
                            }catch (e) {
                                resObj.body = dezipped.toString('utf-8');
                            }
                            proxy.emit("beforeResponse", resObj);                      
                        });
                    }else {
                        try{
                            resObj.body = JSON.parse(buffer.toString('utf-8'));
                        }catch (e) {
                            resObj.body = buffer.toString('utf-8');
                        }
                        proxy.emit("beforeResponse", resObj);
                    }
                    // u can change resonse here
                });

            }else {
                //proxy.emit("beforeResponse", resObj);
            }

            remoteResponse.pipe(res);
            // Res could not write, but it could close connection
            res.pipe(remoteResponse);

        });

        remoteRequest.on('error', function(e) {
            proxy.emit("requestError", e, req, res);

            res.writeHead(502, 'Proxy fetch failed');
//            res.end();
//            remoteRequest.end();
        });

        req.pipe(remoteRequest);

        // Just in case if socket will be shutdown before http.request will connect
        // to the server.
        res.on('close', function() {
            remoteRequest.abort();
        });
    }

}

MiniProxy.prototype.connectHandler = function(req, socket, head) {
    try {
        var self = this;

        var requestOptions = {
            host: req.url.split(':')[0],
            port: req.url.split(':')[1] || 443
        };

        self.emit("beforeRequest", requestOptions);
        connectRemote(requestOptions, socket);

        function ontargeterror(e) {
            console.log(req.url + " Tunnel error: " + e);
            _synReply(socket, 502, "Tunnel Error", {}, function() {
                try {
                    socket.end();
                }
                catch(e) {
                    console.log('end error' + e.message);
                }

            });
        }

        function connectRemote(requestOptions, socket) {
            var tunnel = net.createConnection(requestOptions, function() {
                //format http protocol
                _synReply(socket, 200, 'Connection established', {
                        'Connection': 'keep-alive'
                    },
                    function(error) {
                        if (error) {
                            console.log("syn error", error.message);
                            tunnel.end();
                            socket.end();
                            return;
                        }
                        tunnel.pipe(socket);
                        socket.pipe(tunnel);
                    }
                );
            });

            tunnel.setNoDelay(true);

            tunnel.on('error', ontargeterror);
        }
    } catch (e) {
        console.log("connectHandler error: " + e.message);
    }

}

function _synReply(socket, code, reason, headers, cb) {
    try {
        var statusLine = 'HTTP/1.1 ' + code + ' ' + reason + '\r\n';
        var headerLines = '';
        for (var key in headers) {
            headerLines += key + ': ' + headers[key] + '\r\n';
        }
        socket.write(statusLine + headerLines + '\r\n', 'UTF-8', cb);
    } catch (error) {
        cb(error);
    }
}

module.exports = {
    'setWebContents': function(webContents) {
        _webContents = webContents;
        var proxy = new MiniProxy();
        proxy.start();
    }
};