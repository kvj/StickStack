var DropBox = function(key, secret) {//Creates new instance of DropBox
    this.oauthData = {consumerKey: key, consumerSecret: secret};
    this.urlPrefix = 'https://api.dropbox.com/0/';
    this.urlFilesPrefix = 'https://api-content.dropbox.com/0/';
};

DropBox.prototype.getTokens = function(username, password, handler) {//Returns token
    var message = {
        action: this.urlPrefix+'token',
        method: 'POST',
        parameters: {email: username, password: password, status_in_response: true}
    };
    OAuth.completeRequest(message, this.oauthData);
    var url = OAuth.addToURL(message.action, message.parameters);
    $.ajax({
        type: message.method,
        url: url,
        async: true,
        dataType: 'json',
        success: _.bind(function(data) {//
            if (data.status == 200 && data.body) {//Got keys
                this.oauthData.token = data.body.token;
                this.oauthData.tokenSecret = data.body.secret;
                handler({token: this.oauthData.token, secret: this.oauthData.tokenSecret});
            } else {//Error
                handler(null, (data.body && data.body.error)? data.body.error: data.response || 'Unknown error');
            };
        }, this),
        error: function(err, message) {//
            handler(null, 'HTTP error');
        }
    });
};

DropBox.prototype.fileInfo = function(filename, handler) {//Gets file info
    var message = {
        action: this.urlPrefix+'metadata/dropbox/'+filename,
        method: 'GET',
        parameters: {list: false, status_in_response: true}
    };
    OAuth.completeRequest(message, this.oauthData);
    var url = OAuth.addToURL(message.action, message.parameters);
    //log('fileInfo', url);
    $.ajax({
        type: message.method,
        url: url,
        async: true,
        dataType: 'json',
        success: _.bind(function(data) {//
            if (data.status == 200 && data.body) {//Got meta info
                handler(data.body);
            } else {//Error
                handler(null, data.response || 'Status: '+data.status);
            };
        }, this),
        error: function(err, message) {//
            handler(null, 'HTTP error');
        }
    });
};

DropBox.prototype.download = function(path, filename, handler) {//path => filename
    var file = new air.File(filename);
    if (file.exists && file.isDirectory) {//Error
        handler(null, 'File is folder');
        return;
    };
    var message = {
        action: this.urlFilesPrefix+'files/dropbox/'+path,
        method: 'GET',
        parameters: {}
    };
    OAuth.completeRequest(message, this.oauthData);
    var url = OAuth.addToURL(message.action, message.parameters);
    try {
        var request = new air.URLRequest(url);
        request.useCache = false;
        request.cacheResponse = false;
        var loader = new air.URLLoader();
        loader.dataFormat = 'binary';
        loader.addEventListener(air.IOErrorEvent.IO_ERROR, function (e){
            log('IO error', e.errorID, e.text);
            handler(null, 'File not found');
        });
        loader.addEventListener(air.Event.COMPLETE, _.bind(function(e){
            //log('Complete', loader.data);
            try {
                var fileStream = new air.FileStream();
                fileStream.open(file, air.FileMode.WRITE);
                fileStream.writeBytes(loader.data);
                fileStream.close();
                handler(file);
            } catch (e) {//File write error
                log('File write error', e);
                handler(null, 'File write error');
            }
        }, this));
        loader.load(request);
    } catch (e) {//File download error
        handler(null, 'Download error');
    }
};

DropBox.prototype.upload = function(filename, path, handler) {//Uploads file to server
    var file = new air.File(filename);
    if (!file.exists || file.isDirectory) {//Error
        handler(null, 'Invalid file provided');
        return;
    };
    var fileContents = new air.ByteArray();
    try {
        var fileStream = new air.FileStream();
        fileStream.open(file, air.FileMode.READ);
        fileStream.readBytes(fileContents, 0, file.size);
        fileStream.close();
    } catch (e) {//File read error
        handler(null, 'File read error');
        return;
    }
    var message = {
        action: this.urlFilesPrefix+'files/dropbox/'+path,
        method: 'POST',
        parameters: {file: path, status_in_response: true}
    };
    message.action = message.action.substr(0, message.action.lastIndexOf('/')+1);
    OAuth.completeRequest(message, this.oauthData);
    var url = OAuth.addToURL(message.action, message.parameters);
    var buffer = new air.ByteArray();
    try {
        var boundary = '--------------======-------------------AaB03x';
        var request = new air.URLRequest(url);
        request.useCache = false;
        request.cacheResponse = false;
        request.contentType = 'multipart/form-data; boundary='+boundary;
        request.method='POST';
        buffer.writeUTFBytes("--"+boundary+"\r\n");
        buffer.writeUTFBytes('Content-Disposition: form-data; name="file"; filename="'+path+'"\r\n');
        buffer.writeUTFBytes("Content-Transfer-Encoding: binary\r\n");
        buffer.writeUTFBytes("Content-Length: "+fileContents.length+"\r\n");
        buffer.writeUTFBytes("Content-Type: application/octet-stream\r\n");
        buffer.writeUTFBytes("\r\n");
        buffer.writeBytes(fileContents, 0, fileContents.length);
        buffer.writeUTFBytes("--"+boundary+"--\r\n");
        request.data = buffer;
        var loader = new air.URLLoader();
        loader.addEventListener(air.IOErrorEvent.IO_ERROR, function (e){
            log('IO error', e.errorID, e.text);
            handler(null, 'IO error');
        });
        loader.addEventListener(air.Event.COMPLETE, _.bind(function(e){
            //log('Complete', loader.data);
            try {
                var data = JSON.parse(loader.data.toString());
                if (data && data.status == 200) {//Upload done
                    this.fileInfo(path, handler);
                } else {
                    handler(null, data? data.response: null || 'Upload error');
                };
            } catch (e) {//JSON error
                handler(null, 'Upload error');
            }
        }, this));
        //loader.addEventListener(air.ProgressEvent.PROGRESS, _.bind(function(e){
            ////log('Progress', e.bytesLoaded, e.bytesTotal);
        //}, this));
        log('Uploading', file.name, fileContents.length, url, buffer.length);
        loader.load(request);
    } catch (e) {//Upload error
        log('Upload error:', e);
        handler(null, 'Upload error');
    }
};

DropBox.prototype.detectSync = function(path, filename, handler) {//Compares modification times to find sync direction
    var file = new air.File(filename);
    if (file.exists && (file.isDirectory || file.isPackage)) {//Error - local is dir
        handler(0);
        return;
    };
    var localTime = 0;
    if (file.exists) {
        localTime = file.modificationDate.time;
    };
    this.fileInfo(path, function(data) {//OK
        if (data) {//File exists
            if (data.is_dir) {//Error
                handler(0);
                return;
            };
            var dboxTime = new Date(data.modified).getTime();
            if (localTime) {//Return -
                handler(dboxTime-localTime);
            } else {//Return dboxTime
                return handler(dboxTime);
            };
        } else {//No file in dropbox
            if (!localTime) {//No files there and here
                return handler(-1);
            } else {
                handler(-localTime);
            };
        };
    });
};

