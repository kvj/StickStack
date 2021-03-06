var _proxy = function(datamanager, method, handler, params) {//Proxy to DataManager
    if (!params) {
        params = [];
    };
    if (method == 'tagInfo') {
        return datamanager.tagInfo(params[0]);
    };
    if (method == 'formatTag') {
        return datamanager.formatTag(params[0]);
    };
    if (method == 'adoptTag') {
        return datamanager.adoptTag(params[0]);
    };
    if (method == 'createBookmark') {
        return manager.navProvider.add(null, params[0]);
    };
    if (method == 'editMap') {
        new MapsEditor(datamanager, params[0], handler);
        return true;
    };
    if (method == 'editCard') {
        new CardEditor(datamanager, params[0], params[1], handler);
        return true;
    };    
    if (method == 'tagsAutoComplete') {
        tagsAutoComplete(datamanager, params[0], handler);
        return true;
    };
    
    if (method == 'getNote') {
        datamanager.getNote(params[0], function (err, note) {
            if (params[1] && !err) {
                // Load tags
                datamanager.loadTags([note], function(list, err) {
                    if (list) {
                        handler(null, note, list);
                    } else {
                        handler(null, note);
                    };
                });
            } else {
                handler(err, note);
            }
        });
        return true;
    };
    if (method == 'getSheet') {
        datamanager.getSheet(params[0], function (err, sheet) {
            handler(err, sheet);
        });
        return true;
    };
    if (method == 'getAttachment') {
        datamanager.getAttachment(params[0], function (err, uri) {
            handler(err, uri);
        });
        return true;
    };
    if (method == 'loadNotes') {
        datamanager.selectNotes(params[0], function(list, err) {
            if (list) {
                datamanager.loadTags(list, function(list, err) {
                    if (list) {
                        handler(datamanager.sortNotes(list, params[1]));
                    } else {
                        handler(null, err);
                    };
                });
            } else {
                handler(null, err);
            };
        }, true, params[2]);
        return true;
    };
    if (datamanager.in_sync) {
        // log('Defer edit:', method, params);
        datamanager.edits.push({method: method, handler: handler, params: params});
        _disableUI();
        _showInfo('Sync is in progress');
        return true;
    };
    if (method == 'addSheet') {
        datamanager.addSheet(handler);
        return true;
    };
    if (method == 'updateSheet') {
        datamanager.updateSheet(params[0], params[1], handler);
        return true;
    };
    if (method == 'removeSheet') {
        datamanager.removeSheet(params[0], handler);
        return true;
    };
    if (method == 'updateTagConfig') {
        datamanager.updateTagConfig(params[0], handler);
        return true;
    };
    if (method == 'removeTagConfig') {
        datamanager.removeTagConfig(params[0], handler);
        return true;
    };
    if (method == 'createAttachment') {
        datamanager.createAttachment(params[0], params[1], function (err) {
            handler(err);
        });
        return true;
    };
    if (method == 'createNote') {
        var splitByStr = function (text, delim) {
            var result = [];
            var index = text.indexOf(delim);
            while (index != -1) {
                result.push(text.substr(0, index));
                text = text.substr(index+delim.length);
                index = text.indexOf(delim);
            }
            result.push(text);
            return result;
        };
        var texts = splitByStr(params[0] || '', '\n...\n');
        // log('Texts: ', texts);
        var gr = new AsyncGrouper(texts.length, function (gr) {
            var err = gr.findError();
            if (err) {//Found error
                handler(null, err);
            } else {//No error
                // log('Results:', gr.results[0]);
                handler(gr.results[0][0]);
            };
        });
        for (var i = 0; i < texts.length; i++) {
            var txt = texts[i];
            datamanager.updateNote(null, txt, null, function(id, err) {
                if (id) {//Add notes
                    var tags = datamanager.noteToSheet(params[1], []);
                    datamanager.updateTags(id, tags, function(id, err) {
                        if (id) {
                            gr.fn(null, id);
                        } else {
                            gr.fn(err);
                        };
                    });
                } else {
                    gr.fn(err);
                };
            });
        };
        return true;
    };
    if (method == 'putNote') {
        datamanager.putNote(params[0], function(id, err) {
            if (id) {//Add notes
                var tags = datamanager.noteToSheet(params[1], params[0].tags);
                // log('Saving tags', tags);
                datamanager.updateTags(id, tags, function(id, err) {
                    if (id) {
                        handler(id);
                    } else {
                        handler(null, err);
                    };
                });
            } else {
                handler(null, err);
            };
        });
        return true;
    };
    if (method == 'editNoteField') {
        datamanager.updateNote(params[0], params[1], params[2], function(id, err) {
            if (id) {
                handler(id);
            } else {
                handler(null, err);
            };
        });
        return true;
    };
    if (method == 'removeNote') {
        datamanager.removeNote(params[0], function(id, err) {
            if (id) {
                handler(id);
            } else {
                handler(null, err);
            };
        });
        return true;
    };
    //log('Proxy', method, params);
    if (method == 'addTag') {
        datamanager.getTags(params[0], function(tags, err) {
            if (tags) {
                // log('Add tag', tags, params[1], params[2]);
                if (params[2]) {
                    tags = datamanager.tagToTag(tags, params[1], params[2]);
                } else {
                    tags = datamanager.tagToNote(tags, params[1]);
                };
                // log('Saving', tags);
                datamanager.updateTags(params[0], tags, function(id, err) {
                    if (id) {
                        handler(id);
                    } else {
                        handler(null, err);
                    };
                });
            } else {
                handler(params[0]);
            };
        });
        return true;
    };
    if (method == 'removeTag') {
        datamanager.getTags(params[0], function(tags, err) {
            if (tags) {
                tags = datamanager.tagToTag(tags, params[1]);
                datamanager.updateTags(params[0], tags, function(id, err) {
                    if (id) {
                        handler(id);
                    } else {
                        handler(null, err);
                    };
                });
            } else {
                handler(params[0]);
            };
        });
        return true;
    };
    if (method == 'moveNote') {
        datamanager.getTags(params[0], function(tags, err) {
            //log('Selected tags', tags, err, params[1]);
            if (tags) {
                tags = datamanager.noteToSheet(params[1], tags);
                datamanager.updateTags(params[0], tags, function(id, err) {
                    if (id) {
                        handler(id);
                    } else {
                        handler(null, err);
                    };
                });
            } else {
                handler(null, err);
            };
        });
        return true;
    };
    handler(null, 'No such method: '+method);
};

var DataManager = function(database) {//Do DB operations
    this.db = database;
    this.tagControllers = [];
    this.events = new EventEmitter();
    this.in_sync = false;
    this.edits = [];
    database.on_sync.on('start', _.bind(function () {
        // log('Sync actually started');
        this.in_sync = true;
    }, this));
    database.on_sync.on('finish', _.bind(function () {
        this.in_sync = false;
        var arr = this.edits;
        this.edits = [];
        if (arr.length>0) {
            // log('After sync edits:', arr.length);
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                // log('Re-run edit:', item.method, item.params);
                _proxy(this, item.method, item.handler, item.params);
            };
            _enableUI();
        };
    }, this));
    var DefaultTag = function() {
        this.name = 'default';
    };
    DefaultTag.prototype.accept = function(text) {//Default - accept all
        return true;
    };
    DefaultTag.prototype.adopt = function(text) {//Default - no change
        return text;
    };
    DefaultTag.prototype.format = function(text) {//Default - no change
        return text;
    };
    DefaultTag.prototype.info = function(text) {//Default - no change
        return null;
    };
    DefaultTag.prototype.store = function(text) {//Default - no change
        return ['', 0];
    };
    DefaultTag.prototype._in = function (params) {
        return {op: 'in', stream: 'notes_tags', field: 'note_id', query: params};
    }

    DefaultTag.prototype.select = function(text, values) {//Default 
        if (text && _.endsWith(text, '*')) {//
            values.push('id', this._in(['text', {op: 'like', 'var': text.substr(0, text.length-1)+'%'}]));
            return 'nt.text like ?';
        };
        values.push('id', this._in(['text', text]));
        return 'nt.text=?';
    };

    DefaultTag.prototype.formatNote = function(text, note) {//Default
    };

    var NoTagsTag = function() {
        this.name = 'no-tags';
        this.display = 'no-tags';
    };
    NoTagsTag.prototype = new DefaultTag();

    NoTagsTag.prototype.accept = function(text) {
        if (text == this.name) {
            return true;
        };
        return false;
    };

    NoTagsTag.prototype.store = function(text) {//Convert to Date
        return [this.name, 0];
    };

    NoTagsTag.prototype.format = function(text) {
        return this.display;
    };

    NoTagsTag.prototype.select = function(text, values) {//Default 
        values.push({
            op: 'or', 
            'var': [
                'id', this._in(['text', text]),
                {
                    op: 'not',
                    'var': ['id', this._in([])]
                }
            ]
        })
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var NoteTag = function() {
        this.name = 'note';
        this.display = 'note';
    };
    NoteTag.prototype = new DefaultTag();

    NoteTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'n:')) {
            return true;
        };
        return false;
    };

    NoteTag.prototype.store = function(text) {//Convert to Date
        return ['n:', parseInt(text.substr(2), 10)];
    };

    NoteTag.prototype.format = function(text) {
        return 'note';
    };

    NoteTag.prototype.select = function(text, values) {//Default 
        if (_.startsWith(text, 'n:!')) {
            values.push('id', this._in(['type', 'n:', 'value', text.substr(3)]));
            return '';
        };
        var id = parseInt(text.substr(2), 10);
        // values.push('n:');
        // values.push(id);
        // values.push(id);
        values.push({
            op: 'or', 
            'var': [
                'id', id, 
                {
                    op: 'and', 
                    'var': [
                        'id', this._in(['type', 'n:', 'value', id])
                    ]
                }]
        })
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var GeoTag = function() {
        this.name = 'geo';
        this.display = 'geo';
    };
    GeoTag.prototype = new DefaultTag();

    GeoTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'g:')) {
            return true;
        };
        return false;
    };

    GeoTag.prototype.store = function(text) {//Convert to Date
        return ['g:', 0];
    };

    GeoTag.prototype.format = function(text) {
        return 'geo';
    };

    GeoTag.prototype.select = function(text, values) {//Default 
        if (text == 'g:*') {
            values.push('id', this._in(['text', {op: 'like', 'var': 'g:%'}]));
            return 'like';
        };
        values.push('id', this._in(['text', text]));
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var LinkTag = function() {
        this.name = 'link';
        this.display = 'link';
    };
    LinkTag.prototype = new DefaultTag();

    LinkTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'l:')) {
            return true;
        };
        return false;
    };

    LinkTag.prototype.store = function(text) {//Convert to Date
        return ['l:', 0];
    };

    LinkTag.prototype.format = function(text) {
        return 'link';
    };

    LinkTag.prototype.select = function(text, values) {//Default 
        if (text == 'l:*') {
            values.push('id', this._in(['text', {op: 'like', 'var': 'l:%'}]));
            return 'like';
        };
        values.push('id', this._in(['text', text]));
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var SheetTag = function() {
        this.name = 'sheet';
        this.display = 'sheet';
    };
    SheetTag.prototype = new DefaultTag();

    SheetTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 's:')) {
            return true;
        };
        return false;
    };

    SheetTag.prototype.store = function(text) {//Convert to Date
        return ['s:', 0];
    };

    SheetTag.prototype.format = function(text) {
        return 'sheet';
    };

    SheetTag.prototype.select = function(text, values) {//Default 
        values.push('id', this._in(['text', text]));
        return '';
    };

    var MarkTag = function(config) {
        this.config = config;
        this.name = config.name;
        this.display = config.name;
    };
    MarkTag.prototype = new DefaultTag();

    MarkTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', this.name+':')) {
            return true;
        };
        if (this.config.simple && this.name == text) {
            return true;
        };
        return false;
    };

    MarkTag.prototype.store = function(text) {
        if (this.config.simple) {
            return ['', 0];
        };
        return [this.name+':', 0];
    };

    MarkTag.prototype.format = function(text) {
        if (this.config.format) {
            return this.config.format;
        };
        if (text.length>this.name.length+1) {
            var caption = text.substr(this.name.length+1).replace('+', ' ');
            return (this.config.prefix || '')+caption;
        };
        return this.name;
    };

    MarkTag.prototype.select = function(text, values) {//Default 
        if (text == this.name+':*') {
            values.push('id', this._in(['type', this.name+':']));
            return 'like';
        };
        values.push('id', this._in(['text', text]));
        return '';
    };

    var OKTag = function() {
        this.name = 'ok';
        this.display = 'ok';
    };
    OKTag.prototype = new DefaultTag();

    OKTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'ok:')) {
            return true;
        };
        return false;
    };

    OKTag.prototype.store = function(text) {//Convert to Date
        return ['ok:', 0];
    };

    OKTag.prototype.format = function(text) {
        if (text == 'ok:') {
            return '?OK';
        };
        return 'OK';
    };

    OKTag.prototype.select = function(text, values) {//Default 
        if (text == 'ok:*') {
            values.push('id', this._in(['text', {op: 'like', 'var': 'ok:%'}]));
            return 'like';
        };
        values.push('id', this._in(['text', text]));
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var PathTag = function() {
        this.name = 'path';
        this.display = 'path';
    };
    PathTag.prototype = new DefaultTag();

    PathTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'p:')) {
            return true;
        };
        return false;
    };

    PathTag.prototype.store = function(text) {//Convert to Date
        return ['p:', 0];
    };

    PathTag.prototype.format = function(text) {
        return 'path';
    };

    PathTag.prototype.select = function(text, values) {//Default 
        values.push('id', this._in(['text', text]));
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var AttachmentTag = function() {
        this.name = 'file';
        this.display = 'file';
    };
    AttachmentTag.prototype = new DefaultTag();

    AttachmentTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'a:')) {
            return true;
        };
        return false;
    };

    AttachmentTag.prototype.store = function(text) {//Convert to Date
        return ['a:', 0];
    };

    AttachmentTag.prototype.format = function(text) {
        if (_.endsWith(text, '.jpg')) {
            return ':1:'
        };
        return 'file';
    };

    AttachmentTag.prototype.select = function(text, values) {//Default 
        if (text == 'a:*') {
            values.push('id', this._in(['text', {op: 'like', 'var': 'a:%'}]));
            return 'like';
        };
        values.push('id', this._in(['text', text]));
        return '(nt.type=? and nt.value=?) or n.id=?';
    };

    var DateTag = function() {//Date starts d:
        this.reg = /^d:(((\d{4})(\d{2})(\d{2}))|((\+|\-)(\d+)(d|w|m|y))|(((w(\+|\-)?(\d{1,2}))|(m(\+|\-)?(\d{1,2})))?(y(\+|\-)?(\d{1,4}))?))$/;
        this.rangeReg = /^d:(.+):(.+)$/;
        this.name = 'date';
    };
    DateTag.prototype = new DefaultTag();

    DateTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 'd:')) {
            return true;
        };
        return false;
    };

    DateTag.prototype._toDate = function(text) {
        var m = text.match(this.reg);
        if (!m) {
            return {dt: new Date()};
        };
        // for (var i = 0; i < m.length; i++) {
        //     log('to date:', i, m[i]);
        // };
        var dt = new Date();
        var _sign = function (val) {
            return m[7] == '-'? -1: 1;
        };
        if (m[2]) {//
            dt.setDate(1);
            dt.setFullYear(parseInt(m[3], 10));
            dt.setMonth(parseInt(m[4], 10)-1);
            dt.setDate(parseInt(m[5], 10));
        } else if (m[7]) {//+-
            var sign = _sign(m[7]);
            if (m[9] == 'd') {//Add date
                dt.setDate(dt.getDate()+sign*m[8]);
            };
            if (m[9] == 'w') {//Add date
                dt.setDate(dt.getDate()+sign*m[8]*7);
            };
            if (m[9] == 'm') {//Add date
                dt.setMonth(dt.getMonth()+sign*m[8]);
            };
            if (m[9] == 'y') {//Add date
                dt.setFullYear(dt.getFullYear()+sign*m[8]);
            };
        } else {
            // 3rd group
            var result = {};
            var type = 'y';
            var nowDay = dt.getDate();
            var nowMonth = dt.getMonth();
            dt = new Date(dt.getFullYear(), 0, 1);
            if (m[18]) { // Have year
                if(m[19]) { // Have sign
                    dt.setFullYear(dt.getFullYear()+_sign(m[19])*m[20]);
                } else {
                    dt.setFullYear(m[20]);
                }
            };
            if (m[12]) { // Have week
                var wk = new Date().getWeek();
                if (m[13]) {
                    wk += _sign(m[13])*m[14];
                } else {
                    wk = m[14];
                }
                type = 'w';
                dt.setWeek(wk, 0);
            };
            if (m[15]) { // Have month
                var mn = new Date().getMonth();
                if (m[16]) {
                    mn += _sign(m[16])*m[17];
                } else {
                    mn = +m[17]-1;
                }
                type = 'm';
                dt.setMonth(mn);
            };
            return {dt: dt, type: type};
        }
        //log('_toDate', text, dt);
        return {dt: dt};
    };
    DateTag.prototype.info = function(text) {//Get tag info
        var dt = this._toDate(text);
        if (dt.type) {
            var dtstart = new Date(dt.dt.getTime());
            var dtend = new Date(dtstart.getTime());
            if (dt.type == 'w') {
                dtend.setDate(dtstart.getDate()+6);
            };
            if (dt.type == 'm') {
                dtend.setMonth(dtstart.getMonth()+1);
                dtstart.setDate(1);
                dtend.setDate(0);
            };
            if (dt.type == 'y') {
                dtstart.setMonth(0);
                dtstart.setDate(1);
                dtend.setDate(1);
                dtend.setMonth(0);
                dtend.setFullYear(dtstart.getFullYear()+1);
                dtend.setDate(0);
            };
            return {dstart: dtstart, dend: dtend, type: dt.type};
        };
        return null;
    };

    DateTag.prototype.adopt = function(text) {//Convert to Date and format
        var dt = this._toDate(text);
        if (dt.type) {
            var result = '';
            if (dt.type == 'w') {
                result += 'w'+dt.dt.getWeek();
            };
            if (dt.type == 'm') {
                result += 'm'+(dt.dt.getMonth()+1);
            };
            result += 'y'+dt.dt.getFullYear();
            return 'd:'+result;
        };
        return 'd:'+dt.dt.format('yyyymmdd');
    };

    DateTag.prototype.store = function(text) {//Convert to Date
        var dt = this._toDate(text);
        if (dt.type) {
            return ['d:', 0];
        };
        return ['d:', parseInt(this._toDate(text).dt.format('yyyymmdd'), 10)];
    };

    DateTag.prototype.format = function(text) {//Convert to Date and format
        var now = new Date();
        var dt = this._toDate(text);
        if (dt.type) {
            result = '';
            if (dt.type == 'w') {
                result += 'Week '+dt.dt.getWeek();
            };
            if (dt.type == 'm') {
                result += dt.dt.format('mmm');
            };
            if (dt.type == 'y') {
                result += dt.dt.getFullYear();
            } else {
                if (now.getFullYear() != dt.dt.getFullYear()) {
                    result +='/'+dt.dt.format('yy');
                };
            }
            return result;
        };
        return dt.dt.format('m/d'+(now.getFullYear() != dt.dt.getFullYear()? '/yy': ''));
    };

    DateTag.prototype.select = function(text, values) {//Default 
        var m = text.match(this.rangeReg);
        if (m) {
            var dtstart = this._toDate('d:'+m[1]);
            var dtend = this._toDate('d:'+m[2]);
            // values.push('d:');
            // values.push(dtstart.format('yyyymmdd'));
            // values.push(dtend.format('yyyymmdd'));
            values.push('id', this._in(['type', 'd:', 
                'value', {op: '>=', 'var': dtstart.dt.format('yyyymmdd')}, 
                'value', {op: '<=', 'var': dtend.dt.format('yyyymmdd')}
            ]));
            return 'nt.type=? and nt.value>=? and nt.value<=?';
        };
        var dt = this._toDate(text);
        var dinfo = this.info(text);
        // log('Select DateTag', dinfo);
        if (dinfo) {
            var dtstart = dinfo.dstart;
            var dtend = dinfo.dend;
            if (dinfo.type == 'y') {
                // Only by direct tag
                values.push('id', this._in(['type', 'd:', 'text', this.adopt(text)]));
            } else {
                values.push({
                    op: 'or', 
                    'var': [
                        'id', this._in(['type', 'd:', 
                            'value', {op: '>=', 'var': dtstart.format('yyyymmdd')}, 
                            'value', {op: '<=', 'var': dtend.format('yyyymmdd')}
                        ]), 'id', this._in(['type', 'd:', 'text', this.adopt(text)])
                    ]
                })
            }
            return '';
        };
        return DefaultTag.prototype.select(this.adopt(text), values);
    };

    var TimeTag = function() {//Time starts with t:
        var timePart = '(((\\d{1,2})(:(\\d{2}))?(a|p))|(\\d{1,4}))';
        this.reg = new RegExp('^t:'+timePart+'(\\-'+timePart+')?$');
        this.name = 'time';
    };
    TimeTag.prototype = new DefaultTag();

    TimeTag.prototype.accept = function(text) {
        if (_.startsWith(text || '', 't:')) {
            return true;
        };
        return false;
    };

    TimeTag.prototype._toTime = function(text) {
        var dt = new Date();
        var m = text.match(this.reg);
        if (!m) {
            return [dt.getHours()*100];
        };
        var regToMins = function (start) {
            var hrs = 0;
            var mins = 0;
            if (m[start+7]) {//Number
                hrs = Math.floor(parseInt(m[start+7], 10)/100);
                mins = parseInt(m[start+7], 10) % 100;
            } else {//3 5 6
                hrs = parseInt(m[start+3], 10);
                mins = parseInt(m[start+5], 10) || 0;
                var ap = m[start+6] || 'a';
                if (hrs == 12 && ap == 'p') {
                    hrs = 0;
                    ap = 'a';
                };
                if (ap == 'p') {
                    hrs += 12;
                };
            };
            if (hrs>23) {
                hrs = 23;
            };
            if (mins>59) {
                mins = 59;
            };
            return hrs*100+mins;            
        };
        // for (var i = 0; i < m.length; i++) {
        //     log('_toTime', i, m[i]);
        // };
        var tstart = regToMins(0);
        if (m[8]) {
            var tend = regToMins(8);
            if (tend>tstart) {
                return [tstart, tend];
            };
        };
        return [tstart];
        // var hrs = 0;
        // var mins = 0;
        // if (m[7]) {//Number
        //     hrs = Math.floor(parseInt(m[7], 10)/100);
        //     mins = parseInt(m[7], 10) % 100;
        // } else {//3 5 6
        //     hrs = parseInt(m[3], 10);
        //     mins = parseInt(m[5], 10) || 0;
        //     var ap = m[6] || 'a';
        //     if (hrs == 12 && ap == 'p') {
        //         hrs = 0;
        //         ap = 'a';
        //     };
        //     if (ap == 'p') {
        //         hrs += 12;
        //     };
        // };
        // if (hrs>23) {
        //     hrs = 23;
        // };
        // if (mins>59) {
        //     mins = 59;
        // };
        // return hrs*100+mins;
    };

    TimeTag.prototype.adopt = function(text) {//Convert to Date and format
        var times = this._toTime(text);
        if (times.length == 2) {
            return 't:'+times[0]+'-'+times[1];
        };
        return 't:'+times[0];
    };

    TimeTag.prototype.store = function(text) {//Convert to Date
        return ['t:', this._toTime(text)[0]];
    };

    TimeTag.prototype.format = function(text) {//Convert to Date and format
        var tm = this._toTime(text);
        var toStr = function (tm) {
            var hr = Math.floor(tm/100);
            var mins = tm % 100;
            var ap = 'a';
            if (hr==12) {//pm
                ap = 'p';
            };
            if (hr>12) {//1pm
                ap = 'p';
                hr -= 12;
            };
            if (hr == 0) {//12am
                ap = 'a';
                hr = 12;
            };
            var res = ''+hr;
            if (mins>0) {
                res += ':'+mins;
            };
            res += ap;

            return res;
        };
        if (tm.length == 2) {
            return toStr(tm[0])+'-'+toStr(tm[1]);
        };
        return toStr(tm[0]);

    };

    TimeTag.prototype.formatNote = function(text, note) {//Default
        var tm = this._toTime(text);
        var hr = Math.floor(tm[0]/100);
        note.hour = hr;
        if (tm.length == 2) {
            note.hours = [Math.floor(tm[0]/100), Math.floor(tm[1]/100)];
        };
    };

    //TimeTag.prototype.select = function(text, values) {//Default 
        //var m = text.match(this.rangeReg);
        //if (m) {
            //var dtstart = this._toDate('d:'+m[1]);
            //var dtend = this._toDate('d:'+m[2]);
            //values.push('d:');
            //values.push(dtstart.format('yyyymmdd'));
            //values.push(dtend.format('yyyymmdd'));
            //return 'nt.type=? and nt.value>=? and nt.value<=?';
        //};
        //return DefaultTag.prototype.select(this.adopt(text), values);
    //};

    this.tagControllers.push(new DateTag());
    this.tagControllers.push(new TimeTag());
    this.tagControllers.push(new NoteTag());
    this.tagControllers.push(new GeoTag());
    this.tagControllers.push(new PathTag());
    this.tagControllers.push(new LinkTag());
    this.tagControllers.push(new AttachmentTag());
    this.tagControllers.push(new OKTag());
    this.tagControllers.push(new SheetTag());
    this.tagControllers.push(new MarkTag({name: 'contact', prefix: ':b:'}));
    this.tagControllers.push(new MarkTag({name: 'place', prefix: ':12:'}));
    this.tagControllers.push(new MarkTag({name: 'project', prefix: ':26:'}));
    this.tagControllers.push(new MarkTag({name: 'sort', format: 'sort'}));
    this.tagControllers.push(new MarkTag({name: 'display', format: 'display'}));
    this.tagControllers.push(new MarkTag({name: 'autotags', format: 'tags'}));
    this.tagControllers.push(new MarkTag({name: 'fcard', format: 'fcard', simple: true}));
    this.tagControllers.push(new MarkTag({name: 'card', format: 'card', simple: true}));
    this.tagControllers.push(new NoTagsTag());
    this.tagControllers.push(new DefaultTag());

    this.sheetsConfig = {};
    try {
        this.sheetsConfig = JSON.parse(this.db.storage.get('sheets', '{}'));
    } catch (e) {
        log('Error reading sheets config', e);
    }
};

DataManager.prototype.getAttachment = function(name, handler) {
    this.db.storage.getFile(name, _.bind(function (err, uri) {
        handler(err, uri);
    }, this))
};

DataManager.prototype.createAttachment = function(id, path, handler) {
    this.getTags(id, _.bind(function(tags, err) {
        if (tags) {
            this.db.storage.uploadFile(path, _.bind(function (err, name) {
                if (err) {
                    return handler(err);
                };
                tags = this.tagToNote(tags, 'a:'+name);
                this.updateTags(id, tags, _.bind(function (id, err) {
                    if (id) {
                        handler(null, id);
                    } else {
                        handler(err);
                    }
                }, this))
            }, this))
        } else {
            handler(err);
        };
    }, this));
    
};

DataManager.prototype._saveSheetsConfig = function() {
    this.db.storage.set('sheets', JSON.stringify(this.sheetsConfig));
};

DataManager.prototype.modified = function() {//Report modification
    this.events.emit('modified');
};

DataManager.prototype.adoptTag = function(text) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i].adopt(text);
        };
    };
    return text;
};

DataManager.prototype.findTagController = function(text) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i];
        };
    };
    return null;
};

DataManager.prototype.formatTag = function(text) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i].format(text);
        };
    };
    return text;
};

DataManager.prototype.tagInfo = function(text) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i].info(text);
        };
    };
    return null;
};

DataManager.prototype.storeTag = function(text) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i].store(text);
        };
    };
    return ['', 0];
};

DataManager.prototype.selectTag = function(text, values) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i].select(text, values);
        };
    };
    return [];
};

DataManager.prototype.formatNote = function(text, note) {
    for (var i = 0; i < this.tagControllers.length; i++) {
        if (this.tagControllers[i].accept(text)) {
            return this.tagControllers[i].formatNote(text, note);
        };
    };
    return null;
};

DataManager.prototype.config = function(db, index) {
    db.addTable('sheets', {
        id: {id: true},
        title: true,
        group: true,
        ref: true,
        x: {number: true, local: true},
        y: {number: true, local: true},
        width: {number: true},
        height: {number: true},
        visible: {number: true},
        tags: true,
        autotags: true,
        sort: true,
        display: true,
    }, true, index == 1? 10: 2);
    db.addTable('notes', {
        id: {id: true},
        text: true,
        ref: true,
        created: {number: true},
        link: true,
    }, true, index == 1? 5: 1);
    db.addTable('tags', {
        id: {id: true},
        text: true,
        display: true,
        weight: {number: true},
        tag_color: true,
        note_color: true,
    }, true, index == 1? 15: 5);
    db.addTable('notes_tags', {
        id: {id: true},
        note_id: {number: true},
        text: true,
        type: true,
        value: {number: true},
    }, true, index == 1? 10: 3);
    db.schemaRevision = 2;
};

DataManager.prototype.open = function(handler) {//Opens DB
    this.db.open(_.bind(function() {
        handler(this);
    }, this), _.bind(function(error) {//Error
        handler(null, error);
    }, this));
};

DataManager.prototype.addSheet = function(handler) {//Make insert
    var obj = {};
    this.db._save('sheets', obj, _.bind(function (err) {
        this.modified();
        handler(obj.id, err);
    }, this));
};

DataManager.prototype.removeSheet = function(id, handler) {//Removes sheet
    if (this.sheetsConfig[id]) {
        delete this.sheetsConfig[id];
        this._saveSheetsConfig();
    };
    this.db.storage.select('notes_tags', ['text', 's:'+id, 'type', 's:'], _.bind(function (err, data) { // Selected tags with this sheet
        if (err) {
            return handler(null, err);
        };
        var gr = new AsyncGrouper(data.length+1, _.bind(function() {
            var err = gr.findError();
            if (err) {//Found error
                handler(null, err);
            } else {//No error
                handler(id);
            };
            this.modified();
        }, this));
        for (var i = 0; i < data.length; i++) {// Remove tags
            this.db.storage.remove('notes_tags', data[i], gr.fn);
        };
        this.db.storage.remove('sheets', {id: id}, gr.fn);
    }, this));
};

DataManager.prototype.moveSheet = function(id, x, y, handler) {//Make update
    if (!this.sheetsConfig[id]) {
        this.sheetsConfig[id] = {x: 0, y: 0};
    };
    this.sheetsConfig[id].x = x || 0;
    this.sheetsConfig[id].y = y || 0;
    this._saveSheetsConfig();
    handler(null);
};

DataManager.prototype.setSheetVisibility = function(id, visible, handler) {//Make update
    if (visible) {
        if (!this.sheetsConfig[id]) {
            this.sheetsConfig[id] = {x: 0, y: 0};
        };
    } else {
        if (this.sheetsConfig[id]) {
            delete this.sheetsConfig[id];
        };       
    };
    this._saveSheetsConfig();
    handler(null);
};

DataManager.prototype.updateSheet = function(id, data, handler) {//Make update
    data.id = id;
    this.db._save('sheets', data, _.bind(function (err) {
        if (err) {
            return handler(null, err);
        }
        this.modified();
        handler(id);
    }, this));
};

DataManager.prototype.putNote = function(note, handler) {//Insert note with tags
    note.created = new Date().getTime();
    var tags = note.tags;
    if (tags) {
        delete note.tags;
    };
    this.db._save('notes', note, _.bind(function (err) {
        if (err) {
            return handler(null, err);
        };
        if (tags && tags.length>1) {
            this.updateTags(note.id, tags, handler);
        } else {
            handler(note.id);
        };
        this.modified();
    }, this));

};

DataManager.prototype.removeNote = function(id, handler) {//Removes note & tags
    this.db.storage.select('notes_tags', ['note_id', id], _.bind(function (err, data) {
        if (err) {
            return handler(null, err);
        };
        this.db.storage.select('notes_tags', ['text', 'n:'+id, 'type', 'n:'], _.bind(function (err, data2) { // Selected tags with this note
            if (err) {
                return handler(null, err);
            };
            var gr = new AsyncGrouper(data.length+data2.length+1, _.bind(function() {
                var err = gr.findError();
                if (err) {//Found error
                    handler(null, err);
                } else {//No error
                    handler(id);
                };
                this.modified();
            }, this));
            for (var i = 0; i < data.length; i++) {// Remove tags
                this.db.storage.remove('notes_tags', data[i], gr.fn);
            };
            for (var i = 0; i < data2.length; i++) {// Remove tags
                this.db.storage.remove('notes_tags', data2[i], gr.fn);
            };
            this.db.storage.remove('notes', {id: id}, gr.fn);
        }, this))
    }, this));
};

DataManager.prototype.updateNote = function(id, value, field, handler) {//Inserts or updates note
    if (!id) {//Do insert
        var note = {
            created: new Date().getTime()
        };
        note[field || 'text'] = value;
        this.db._save('notes', note, _.bind(function (err) {
            if (err) {
                return handler(null, err);
            };
            this.modified();
            handler(note.id);
        }, this));
    } else {//Update
        this.db.storage.select('notes', ['id', id], _.bind(function (err, data) {
            if (err) {
                return handler(null, err);
            }
            if(data.length == 0) {
                return handler(null, 'Note not found');
            }
            var obj = data[0];
            obj[field || 'text'] = value;
            this.db._save('notes', obj, _.bind(function (err) {
                if (err) {
                    return handler(null, err);
                }
                this.modified();
                handler(id);
            }, this));
        }, this));
    };
};

DataManager.prototype.getSheets = function(handler) {//Gets sheets
    this.db.storage.select('sheets', [], _.bind(function (err, d) {
        if (err) {
            return handler(null, err);
        }
        var data = [];
        for (var i = 0; i < d.length; i++) {//Copy to data
            var row = _.clone(d[i]);
            row.caption = row.title || row.tags || 'Untitled';
            if (this.sheetsConfig[row.id]) {
                row.visible = true;
                row.x = this.sheetsConfig[row.id].x || 0;
                row.y = this.sheetsConfig[row.id].y || 0;
            } else {
                row.visible = false;
                row.x = 0;
                row.y = 0;
            }
            data.push(row);
        };
        handler(data);
    }, this), {order: ['group', 'title']})
};

DataManager.prototype.lineupSheets = function(list, group) {//Sort and add groups
    var result = [];
    var lastGroup = '';
    for (var i = 0; i < list.length; i++) {
        var row = list[i];
        if (row.group) {//Have group
            if (lastGroup != row.group) {//New group - add item
                result.push({caption: row.group, type: 'group'});
                lastGroup = row.group;
            };
            if (row.group != group) {//Skip sheet
                continue;
            };
        };
        row.type = 'sheet';
        result.push(row);
    };
    return result;
};

DataManager.prototype.updateTags = function(id, tags, handler) {//Save tags to DB
    //log('Saving tags', id, tags);
    //Delete first
    tags = this.tagToTag(tags, 'no-tags');
    this.db.storage.select('notes_tags', ['note_id', id], _.bind(function (err, data) {
        if (err) {
            return handler(null, err);
        };
        var gr = new AsyncGrouper(tags.length+data.length, _.bind(function() {
            var err = gr.findError();
            if (err) {//Found error
                handler(null, err);
            } else {//No error
                handler(id);
            };
            this.modified();
        }, this));
        for (var i = 0; i < data.length; i++) {//Add tags
            this.db.storage.remove('notes_tags', data[i], gr.fn);
        };
        for (var i = 0; i < tags.length; i++) {//Do insert
            var type_value = this.storeTag(tags[i]);
            var tag = {
                note_id: id,
                text: tags[i],
                type: type_value[0],
                value: type_value[1]
            };
            this.db._save('notes_tags', tag, gr.fn);
        };
    }, this));
};

DataManager.prototype.getTags = function(id, handler) {//Selects tags from DB
    //log('getTags', id);
    this.db.storage.select('notes_tags', ['note_id', id], _.bind(function (err, data) {
        if (err) {
            return handler(null, err);
        };
        var tags = [];
        for (var i = 0; i < data.length; i++) {//Add tags
            //log('tag', id, data[i].id, data[i].text, data[i]._sync_client, data[i]._sync_delete);
            if (data[i].text) {//Add text
                tags.push(data[i].text);
            };
        };
        handler(tags);
    }, this));
};

DataManager.prototype.getSheet = function(id, handler) {//Selects sheet
    this.db.findOne('sheets', id, _.bind(function (err, data) {
        if (err) {
            return handler(err);
        };
        handler(null, data);
    }, this));
};

DataManager.prototype.getNote = function(id, handler) {//Selects note
    this.db.findOne('notes', id, _.bind(function (err, data) {
        if (err) {
            return handler(err);
        };
        handler(null, data);
    }, this));
};

DataManager.prototype.noteToSheet = function(text, tags) {
    if (!tags) {
        tags = [];
    };
    var parts = (text || '').split(' ');
    var pluses = [];
    var minuses = [];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p) {
            continue;
        };
        if (_.startsWith(p, '-') && p.length>1) {//Minus
            minuses.push(p.substr(1));
        } else {
            if (_.startsWith(p, '+')) {//Plus
                pluses.push(p.substr(1));
            } else {//Add as is
                pluses.push(p);
            };
        };
    };
    for (var i = 0; i < minuses.length; i++) {//Remove first
        var m = minuses[i];
        for (var j = 0; j < tags.length; j++) {//Check every tag
            if (!tags[j] || m == tags[j] || (_.startsWith(tags[j], m.substr(0, m.length-1)) && _.endsWith(m, '*'))) {//Remove tag
                tags.splice(j, 1);
                j--;
            };
        };
    };
    for (var i = 0; i < pluses.length; i++) {//Add tags
        var found = false;
        var tag = this.adoptTag(pluses[i]);
        for (var j = 0; j < tags.length; j++) {//Check existing
            if (tags[j] == tag) {//Found
                found = true;
                break;
            };
        };
        if (!found) {
            tags.push(tag);
        };
    };
    return tags;
};

DataManager.prototype.parseColor = function (color, def) {
    if (!color || color == '#000000' || color == 'transparent') {
        if (def) {
            color = def;
        } else {
            return null;
        }
    }
    if (color.length != 7) {
        return null;
    }
    return [parseInt(color.substr(1, 2), 16), parseInt(color.substr(3, 2), 16), parseInt(color.substr(5, 2), 16)];
};

DataManager.prototype.loadTagConfig = function(handler, raw) {//Selects from tags
    this.db.storage.select('tags', [], _.bind(function (err, data) {
        if(err) {
            return handler(null, err);
        }
        var list = [];
        for (var i = 0; i < data.length; i++) {//
            var row = _.clone(data[i]);
            row.weight = parseInt(row.weight || 0);
            row.caption = (row.weight? '('+row.weight+') ': '') + (row.text || 'No pattern!');
            row.note_color = this.parseColor(row.note_color, null);
            row.text_color = this.parseColor(row.text_color, null);
            row.tag_color = this.parseColor(row.tag_color, raw? null: '#dddddd');
            list.push(row);
        };
        this.tagConfig = list;
        handler(list);

    }, this), {order: ['weight', 'name']});
};

DataManager.prototype.updateTagConfig = function(config, handler) {//Insert
    this.db._save('tags', config, _.bind(function (err) {
        if(err) {
            return handler(null, err)
        }
        this.modified();
        handler(config.id);
    }, this));
};

DataManager.prototype.removeTagConfig = function(id, handler) {//Remove
    this.db.storage.remove('tags', {id: id}, _.bind(function (err) {
        if (err) {
            return handler(null, err);
        }
        this.modified();
        handler(id);
    }, this));
};

DataManager.prototype.tagToNote = function(tags, tag) {//Drop tag to note
    if (!tags) {
        tags = [];
    };
    if (!tag) {
        return tags;
    };
    tag = this.adoptTag(tag);
    for (var i = 0; i < tags.length; i++) {
        if (tags[i] == tag) {//Already here
            return tags;
        };
    };
    tags.push(tag);
    return tags;
};

DataManager.prototype.tagToTag = function(tags, tag, drop) {//Drop tag to tag
    if (!tags) {
        tags = [];
    };
    if (drop) {
        drop = this.adoptTag(drop);
    };
    for (var i = 0; i < tags.length; i++) {
        if (tags[i] == tag || tags[i] == drop) {//Replace tag
            tags.splice(i, 1);
            i--;
        }
    };
    if (drop) {
        tags.push(drop);
    };
    return tags;
};

DataManager.prototype.hasTag = function(tags, tag, last, note) {//Searches tag in array, returns last or first
    var foundTags = [];
    if (_.startsWith(tag, ':') && note) {
        return note[tag.substr(1)];
    };
    for (var i = 0; i < tags.length; i++) {
        if (_.endsWith(tag, '*')) {
            if (_.startsWith(tags[i], tag.substr(0, tag.length-1))) {
                foundTags.push(tags[i]);
                continue;
            };
        } else {
            if (tags[i] == tag) {
                foundTags.push(tags[i]);
            };
        };
    };
    foundTags = foundTags.sort();
    return foundTags.length == 0? null: (last? foundTags[foundTags.length-1]: foundTags[0]);
};

DataManager.prototype.sortNotes = function(list, sort) {
    var arr = (sort || '').split(' ');
    var asc = [];
    for (var i = 0; i < arr.length; i++) {//
        if (!arr[i]) {
            continue;
        };
        if (_.startsWith(arr[i], '-')) {//desc
            asc.push({desc: true, tag: arr[i].substr(1)});
            continue;
        };
        if (_.startsWith(arr[i], '+')) {//desc
            asc.push({desc: false, tag: arr[i].substr(1)});
            continue;
        };
        asc.push({desc: false, tag: arr[i]});
    };
    // log('sortNotes asc', asc, 'desc', desc, sort);
    return list.sort(_.bind(function(a, b) {//Sort by tags
        for (var i = 0; i < asc.length; i++) {
            var ta = this.hasTag(a.tags || [], asc[i].tag, false, a);
            var tb = this.hasTag(b.tags || [], asc[i].tag, false, b);
            var mul = asc[i].desc? -1: 1;
            //log('asc', a.text, b.text, ta, tb, a.tags, b.tags);
            if (ta && tb) {//Both have
                if (ta>tb) {
                    return mul;
                };
                if (ta<tb) {
                    return -1*mul;
                };
            } else {//
                if (ta) {
                    return -1*mul;
                };
                if (tb) {
                    return mul;
                };
            };
        };
        //log('created', a.text, b.text, a.created>b.created? -1: 1);
        if (a.created == b.created) {
            return a.id>b.id? 1: -1
        };
        return a.created>b.created? 1: -1;
    }, this));
};

DataManager.prototype.findTagConfig = function(tag) {
    if (!this.tagConfig) {
        return {weight: 0};
    };
    for (var i = 0; i < this.tagConfig.length; i++) {//
        var conf = this.tagConfig[i];
        if (conf.text && _.endsWith(conf.text, '*')) {//Pattern
            if (_.startsWith(tag || '', conf.text.substr(0, conf.text.length-1))) {
                return conf;
            };
        } else {
            var pattern = this.adoptTag(conf.text);
            if (tag == pattern) {
                return conf;
            };
        }
    };
    return {weight: 0};
};

DataManager.prototype.loadTags = function(list, handler) {//Loads tags to this
    if (!list || list.length == 0) {
        handler(list);
        return;
    };
    var gr = new AsyncGrouper(list.length*2, _.bind(function(gr) {//
        for (var i = 0; i < list.length; i++) {
            var tags = gr.results[i*2][0];
            var subnotes = gr.results[i*2+1][0].length;
            if (!tags) {//Error
                handler(null, gr.results[i][1]);
                return;
            };
            if (tags.length == 0) {
                tags.push('no-tags');
            };
            list[i].tags = tags;
            list[i].subnotes = subnotes;
            //Also create and sort tags to display
            var tag_display = [];
            for (var j = 0; j < tags.length; j++) {//Create text repr.
                var controller = this.findTagController(tags[j]);
                var tag_info = {id: tags[j], caption: tags[j]};
                tag_info.config = this.findTagConfig(tag_info.id);
                if (controller) {
                    tag_info.caption = (ui.features.fontIcons? tag_info.config.label: '') || controller.format(tags[j]);
                    tag_info.display = controller.display || '';
                };
                tag_info.color = tag_info.config.tag_color;
                tag_info.text_color = tag_info.config.text_color;
                tag_info.tag_display = tag_info.config.tag_display;
                tag_display.push(tag_info);
            };
            list[i].tags_captions = tag_display.sort(_.bind(function(a, b) {//Default sorting - by name
                if (a.config.weight>b.config.weight) {
                    return -1;
                };
                if (a.config.weight<b.config.weight) {
                    return 1;
                };
                if (a.id>b.id) {
                    return 1;
                };
                if (a.id<b.id) {
                    return -1;
                };
                return 0;
            }, this));
            list[i].color = this.parseColor('#FFED90');
            for (var j = list[i].tags_captions.length-1; j>=0; j--) {//Remove config, search for note_color
                this.formatNote(list[i].tags_captions[j].id, list[i]);
                if (list[i].tags_captions[j].config.note_color) {
                    list[i].color = list[i].tags_captions[j].config.note_color;
                };
                if (list[i].tags_captions[j].config.display) {
                    list[i].display = list[i].tags_captions[j].config.display;
                };
                delete list[i].tags_captions[j].config;
            };
        };
        handler(list);
    }, this));
    for (var i = 0; i < list.length; i++) {//Load tags
        this.getTags(list[i].id, gr.ok);
        this.selectNotes('n:'+list[i].id, gr.ok);
    };
};

DataManager.prototype.parseText = function(text) {//Parses text and converts to array
    var lines = (text || '').split('\n');
    var result = [];
    var chars = 0;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line) {
            result.push([]);
            chars++;
            continue;
        };
        var parts = [];
        var words = line.split(' ');
        var schemas = ['http://', 'https://', 'geo:', 'tel:', 'sms:', 'mailto:'];
        var markers = ['#', '*', '-', '+', '!', '?'];
        var textStarted = false;
        for (var j = 0; j < words.length; j++) {//Add words
            if (words[j] == '[X]') {//Checked
                parts.push({type: 'checkbox', checked: true, at: chars});
            } else if (words[j] == '[' && words[j+1] == ']') {//Not checked
                parts.push({type: 'checkbox', checked: false, at: chars});
                j++;
                chars += 2;
            } else if (_.startsWith(words[j], '@') && words[j].length>1) {//Tag
                textStarted = true;
                var tag = this.adoptTag(words[j].substr(1));
                var conf = this.findTagConfig(tag);
                parts.push({type: 'tag', at: chars, tag: {id: tag, caption: (ui.features.fontIcons? conf.label: '') || this.formatTag(tag), color: conf.tag_color}});
            } else {
                var skip = false;
                if (!textStarted && words[j].length == 1) {
                    for (var k = 0; k < markers.length; k++) {
                        var m = markers[k];
                        if (words[j] == m) {
                            parts.push({type: 'marker', at: chars, text: m});
                            skip = true;
                            break;
                        };
                    };
                };
                for (var k = 0; !skip && k < schemas.length; k++) {
                    var sch = schemas[k];
                    if (_.startsWith(words[j], sch) && words[j].length>sch.length) {
                        var caption = words[j].substr(sch.length);
                        if (caption.length>20) {
                            caption = caption.substr(0, 18)+'...';
                        };
                        parts.push({type: 'link', at: chars, text: caption, link: words[j]});
                        skip = true;
                        textStarted = true;
                        break;
                    };
                };
                if (!skip) {
                    parts.push({type: 'text', at: chars, text: words[j]});
                    if (words[j]) { // Have text - no markers anymore
                        textStarted = true;
                    };
                };
            }
            chars++;
            chars += words[j].length;
        };
        result.push(parts);
    };
    return result;
};

DataManager.prototype.selectTags = function(query, handler, extra) { // Selects tags by query (for auto-complete)
    extra.field = 'text';
    extra.group = ['text'];
    this.db.storage.select('notes_tags', query, _.bind(function (err, data) { // Search done
        if (err) { // Error - stop
            return handler(err);
        };
        var result = [];
        for (var i = 0; i < data.length; i++) { // Iterate over query result
            var item = data[i];
            result.push({
                value: item.text.replace(' ', '+'), 
                caption: this.formatTag(item.text)
            });
        };
        handler(null, result);
    }, this), extra);
};

DataManager.prototype.selectNotes = function(tags, handler, parse, extra) {//Selects and sorts notes
    var queries = [];
    var arr = (tags || '').split(' ');
    var values = [];
    for (var i = 0; i < arr.length; i++) {
        var line = arr[i];
        if (!line || line == '!') {
            continue;
        };
        line = line.replace('+', ' ');
        var exclude = false;
        if (_.startsWith(line, '!')) {//Not
            line = line.substr(1);
            exclude = true;
        };
        if (_.startsWith(line, '"')) {//Full text search
            line = line.substr(1);
            var buffer = '';
            while (i<arr.length) {
                if (_.endsWith(line, '"')) {
                    buffer += ' '+line.substr(0, line.length-1);
                    break;
                } else {
                    buffer += ' '+line;
                    i++;
                    line = arr[i];
                }
            }
            var op = {op: 'like', 'var': '%'+_.trim(buffer)+'%'};
            if (exclude) {
                values.push({op: 'not', 'var': ['text', op]});
            } else {
                values.push('text', op);
            }
            continue;
        };
        var vals = [];
        var arr2 = line.split('|');//Ors
        if(arr2.length>1) {
            var v = [];
            for (var j = 0; j < arr2.length; j++) {
                if (arr2[j]) {
                    this.selectTag(arr2[j], v);
                };
            };
            if(v.length>0) {
                vals.push({op: 'or', 'var': v})
            }
        } else {
            this.selectTag(line, vals);
        }
        if (exclude) {
            values.push({op: 'not', 'var': vals})
        } else {
            for (var j = 0; j < vals.length; j++) {
                values.push(vals[j])
            };
        }
    };
    // log('Select', tags, values, extra);
    this.db.storage.select('notes', values, _.bind(function (err, data) {
        if (err) {
            return handler(null, err);
        };
        if (!parse) {
            return handler(data);
        }
        var result = [];
        for (var j = 0; j < data.length; j++) {
            var note = _.clone(data[j]);
            // log(JSON.stringify(note, null, 2));
            note.parsed = this.parseText(note.text);
            result.push(note);
        };
        handler(result);
    }, this), extra);
};

