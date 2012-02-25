var JSONProxy = function(config) {//JSON proxy
    this.config = config;
};

JSONProxy.prototype.open = function(on_ok, on_err, db) {//Opens DB connection
    db.exec('select * from sqlite_master limit 1', null, on_ok, on_err)
};

JSONProxy.prototype._batch = function(arr, handler) {//Do AJAX
    if (!arr || arr.length == 0) {
        return handler([]);
    };
    var data = JSON.stringify({
        key: this.config.key,
        prefix: this.config.prefix,
        queries: arr
    });
    log('Executing:', arr.length, data.length);
    var onSuccess = function(d) {//
        try {
            var data = JSON.parse(d);
            var result = [];
            for (var i = 0; i < data.length; i++) {
                var dd = data[i];
                if (!dd.data) {//Stop
                    log('Error in query:', dd.error);
                    return handler(null, dd.error);
                };
                if (arr[i] && arr[i].v && arr[i].v._id) {
                    dd.data.lastID = arr[i].v._id;
                };
                result.push(dd.data);
            };
            //log('jsondb done', result.length);
            handler(result);
        } catch (e) {//JSON error
            log('Error in onSuccess', e);
            handler(null, 'Response error');
        }
    };
    if (CURRENT_PLATFORM == PLATFORM_TIT) {
        var client = Titanium.Network.createHTTPClient();
        client.open('POST', this.config.url);
        client.onload = function(d) {
            onSuccess(client.responseText);
        };
        client.onerror = function(e) {
            handler(null, 'HTTP error: '+e);
        };
        client.send(data);
    } else {//jquery
        $.ajax({
            url: this.config.url,
            timeout: 60000,
            data: data,
            type: 'POST',
            success: function(d) {//Request done
                onSuccess(d);
            },
            error: function(err, st) {//Error done
                handler(null, 'HTTP error: '+st);
            }
        });
    };
};

JSONProxy.prototype.batch = function(configs, handler, db) {
    //log('jsondb batch', configs.length);
    var sqls = [];
    for (var i = 0; i < configs.length; i++) {
        var conf = configs[i];
        conf._sqls = sqls;
        db.query(conf);
    };
    this._batch(sqls, handler);
};

JSONProxy.prototype.exec = function(sql, params, on_ok, on_err, db, direct, config) {//
    if (config && config._sqls) {//Push
        //log('jsondb exec in batch');
        config._sqls.push({q: sql, v: params});
    } else {//Just query
        //log('jsondb direct exec');
        this._batch([{q: sql, v: params}], function(data, err) {//Query done
            if (!data) {
                return on_err(err);
            };
            //log('exec', data.length);
            on_ok(data[0]);
        })
    };
};
