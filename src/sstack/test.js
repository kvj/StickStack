var _test = function() {//Do unit tests
    //_testDBox();
    //_testDManager();
    _testDBSync();
    //_testJSONDB();
};

var _testJSONDB = function() {//JSON DB
    module('JSON DB');
    asyncTest('JSON DB test', function() {
        var proxy = new JSONProxy({
            key: 'abcdef',
            url: 'http://localhost:8888',
            prefix: 'sstack'
        });
        var db = new Database({
            helper: proxy,
            id: 'json'
        });
        db.addTable('table1', {
            id: {id: true},
            text: true,
        }, true, 10);
        db.open(function(db) {//Opened
            ok(db, 'OK');
            db.query({
                type: 'insert',
                table: 'table1',
                fields: ['text'],
                values: ['test'],
                ok: function(data) {
                    ok(data)
                    ok(data.lastID>0, 'ID is '+data.lastID);
                    db.query({
                        type: 'select',
                        query: 'select * from table1',
                        ok: function(data) {//
                            ok(data.length>0, 'Result');
                            equal(data[0].text, 'test');
                            start();
                        }
                    });
                },
                err: function(err) {
                    ok(false, err);
                    start();
                },
            });
        }, function(err) {//Open failed
            ok(false, err);
            start();
        });
    });
};

var _testDBSync = function() {//DB Sync
    module('DBSync');
    asyncTest('DBSync test', function() {
        var proxy = new JSONProxy({
            key: 'abcdef',
            url: 'http://133.139.237.95:8888',
            //url: 'http://localhost:8888',
            prefix: 'test'
        });
        var testSyncs = function(ds1, ds2) {//
            ds2.sync(function(val, err) {
                equal(val.to, 0);
                equal(val.from, 11);
                ds2.query({
                    type: 'select',
                    query: 'select * from table2 where _sync_delete=0',
                    ok: function(data) {
                        equal(data.length, 10, 'Data is OK: '+data.length)
                        ds2.batch([
                            {
                                type: 'insert',
                                table: 'table1',
                                fields: ['text'],
                                values: ['test2']
                            },
                            {
                                type: 'insert',
                                table: 'table2',
                                fields: ['value'],
                                values: [99]
                            },
                            {
                                type: 'remove',
                                table: 'table2',
                                values: [5],
                                where: '"value"=?'
                            },
                        ], function(res, err) {//
                            ok(res, '3 batch OK: '+err);
                            ds2.query({
                                type: 'select',
                                query: 'select * from table2 where _sync_delete=0',
                                ok: function(data) {//
                                    equal(data.length, 10, 'Data is OK: '+data.length)
                                    ds2.sync(function(val) {
                                        equal(val.to, 3);
                                        equal(val.from, 0);
                                        ds1.sync(function(val) {
                                            equal(val.to, 0);
                                            equal(val.from, 3);
                                            ds1.query({
                                                type: 'select',
                                                query: 'select * from table2 where _sync_delete=0',
                                                ok: function(data) {//
                                                    equal(data.length, 10, 'Data is OK')
                                                    ds1.sync(function(val) {
                                                        equal(val.to, 0);
                                                        equal(val.from, 0);
                                                        start();
                                                    });
                                                }
                                            });
                                        })
                                    })
                                }
                            });
                        });
                    },
                });
            });
        };
        var storage1 = new Storage('s1.txt');
        var storage2 = new Storage('s2.txt');
        var configDB = function(db) {//
            db.addTable('t1', {
                id: {id: true},
                text: true,
            }, true, 10);
            db.addTable('t2', {
                id: {id: true},
                t1_id: {number: true},
                value: {number: true},
            }, true, 7);
            //db.schemaRevision = 4;
        };
        var ds1 = new DBSync({
            local: {
                name: ':db1',
                id: 'db1',
                sync: true,
                storage: storage1
            },
            remote: {
                id: 'remote',
                sync: true,
                helper: proxy,
                storage: storage1
            },
            client: 'client1',
            configDB: configDB,
        });
        var ds2 = new DBSync({
            local: {
                name: ':db2',
                id: 'db2',
                sync: true,
                storage: storage2
            },
            remote: {
                helper: proxy,
                id: 'remote',
                sync: true,
                storage: storage2
            },
            client: 'client2',
            configDB: configDB,
        });
        ds1.open(function(db, err) {
            ok(db, err);
            if (!db) {
                return start();
            };
            ds1.reset(function(ds, err) {//
                ok(ds, err);
                if (!ds) {
                    return start();
                };
                ds._open(1, function(db, err) {
                    ok(db, err);
                    if (!db) {
                        return start();
                    };
                    db.reset(function(db, err) {
                        ok(db, err);
                        ds1.query({
                            type: 'insert',
                            table: 't1',
                            fields: ['text'],
                            values: ['test'],
                            ok: function(data) {
                                ok(data.lastID);
                                var originalID = data.lastID;
                                ds1.batch([{
                                    type: 'insert',
                                    table: 't2',
                                    fields: ['t1_id', 'value'],
                                    values: [data.lastID, 1]
                                }, {
                                    type: 'insert',
                                    table: 't2',
                                    fields: ['t1_id', 'value'],
                                    values: [data.lastID, 2]
                                }], function(db, err) {
                                    ok(db, err);
                                    ds1.sync(function(res, err) {
                                        ok(res);
                                        equal(res.to, 3);
                                        equal(res.from, 0);
                                        ds2.reset(function(ds, err) {
                                            ok(ds, err);
                                            ds2.sync(function(res, err) {
                                                ok(res);
                                                equal(res.to, 0);
                                                equal(res.from, 3);
                                                ds2.query({
                                                    type: 'select',
                                                    query: 'select * from t1',
                                                    ok: function(data) {
                                                        equal(data.length, 1);
                                                        var id = data[0].id;
                                                        ds2.batch([{
                                                            type: 'remove',
                                                            table: 't2',
                                                            values: [id],
                                                            where: 't1_id=?'
                                                        }, {
                                                            type: 'insert',
                                                            table: 't2',
                                                            fields: ['t1_id', 'value'],
                                                            values: [id, 3]
                                                        }, {
                                                            type: 'insert',
                                                            table: 't2',
                                                            fields: ['t1_id', 'value'],
                                                            values: [id, 4]
                                                        }], function(res) {
                                                            ok(res.length, 3);
                                                            ds2.sync(function(res, err) {
                                                                equal(res.to, 4);
                                                                equal(res.from, 0);
                                                                ds1.sync(function(res, err) {
                                                                    equal(res.to, 0);
                                                                    equal(res.from, 4);
                                                                    ds1.query({
                                                                        type: 'select',
                                                                        query: 'select * from t2 where t1_id=? and _sync_delete=0 order by value',
                                                                        values: [originalID],
                                                                        ok: function(data) {
                                                                            equal(data.length, 2);
                                                                            start();
                                                                        }
                                                                    });
                                                                })
                                                            });
                                                        });
                                                    },
                                                    err: function(err) {
                                                        ok(!err, err);
                                                        start();
                                                    }
                                                })
                                            })
                                        })
                                    })
                                });
                            },
                            err: function(err) {
                                ok(!err, err);
                                start();
                            }
                        });
                    })
                })
            });
        })
    })
};

var _testDManager = function() {//DataManager
    module('DataManager');
    asyncTest('DataManager test', function() {//Create empty db
        var db = new Database({name: ':test'});
        db.open(function() {//
            db.close();
            var testTagConfig = function(manager) {
                manager.loadTagConfig(function(list) {
                    equal(list.length, 0, 'List is empty');
                    manager.updateTagConfig({}, function(id, err) {
                        ok(id, err);
                        manager.loadTagConfig(function(list) {
                            equal(list.length, 1, 'One element');
                            if (list.length == 1) {//
                                equal(list[0].caption, 'No pattern!', 'Caption OK');
                            };
                            manager.updateTagConfig({id: id, text: 'l1', weight: 2}, function(id2) {
                                ok(id2, 'Updated');
                                equal(id, id2, 'Updated');
                                manager.loadTagConfig(function(list) {
                                    equal(list.length, 1, 'One element');
                                    if (list.length == 1) {//
                                        equal(list[0].caption, '(2) l1', 'Caption OK');
                                    };
                                    manager.updateTagConfig({text: 'l2'}, function(id2) {
                                        ok(id2, 'Added');
                                        manager.loadTagConfig(function(list) {
                                            equal(list.length, 2, 'Two elemens');
                                            if (list.length == 2) {//
                                                equal(list[0].caption, '(2) l1', 'Caption OK');
                                                equal(list[1].caption, 'l2', 'Caption OK');
                                            };
                                            manager.removeTagConfig(id2, function(id2) {
                                                ok(id2, 'Removed');
                                                manager.loadTagConfig(function(list) {
                                                    equal(list.length, 1, 'One elemen');
                                                    if (list.length == 1) {//
                                                        equal(list[0].caption, '(2) l1', 'Caption OK');
                                                    };
                                                    start();
                                                });
                                            })
                                        });
                                    })
                                });

                            })
                        });

                    })
                });
            };
            var testProxy = function(manager) {
                _proxy(manager, 'loadNotes', function(list, err) {//
                    equal(list.length, 2);
                    equal(manager.adoptTag('test'), 'test');
                    //equal(manager.adoptTag('d:'), 'd:20110323');
                    equal(manager.adoptTag('d:20110324'), 'd:20110324');
                    //equal(manager.adoptTag('d:+1d'), 'd:20110324');
                    //equal(manager.adoptTag('d:-2d'), 'd:20110321');
                    //equal(manager.adoptTag('d:+1w'), 'd:20110330');
                    //equal(manager.adoptTag('d:-1m'), 'd:20110223');
                    //equal(manager.adoptTag('d:+2y'), 'd:20130323');
                    
                    //equal(manager.formatTag('d:'), '3/23');
                    equal(manager.formatTag('d:20110324'), '3/24');
                    //equal(manager.formatTag('d:+1d'), '3/24');
                    //equal(manager.formatTag('d:-2d'), '3/21');
                    //equal(manager.formatTag('d:+2w'), '4/6');
                    //equal(manager.formatTag('d:-1m'), '2/23');
                    //equal(manager.formatTag('d:+2y'), '3/23/13');
                    //equal(manager.adoptTag('t:'), 't:900');
                    equal(manager.adoptTag('t:900'), 't:900');
                    equal(manager.adoptTag('t:1000'), 't:1000');
                    equal(manager.adoptTag('t:1530'), 't:1530');
                    equal(manager.adoptTag('t:1:30p'), 't:1330');
                    equal(manager.adoptTag('t:1:30a'), 't:130');
                    equal(manager.adoptTag('t:1:80a'), 't:159');
                    equal(manager.adoptTag('t:1p'), 't:1300');
                    equal(manager.adoptTag('t:2'), 't:2');
                    equal(manager.adoptTag('t:10a'), 't:1000');
                    equal(manager.adoptTag('t:10p'), 't:2200');
                    equal(manager.formatTag('t:1530'), '3:30p');
                    equal(manager.formatTag('t:1500'), '3p');
                    equal(manager.formatTag('t:0'), '12a');
                    equal(manager.formatTag('t:30'), '12:30a');
                    equal(manager.formatTag('t:1000'), '10a');
                    equal(manager.formatTag('t:1099'), '10:59a');
                    testTagConfig(manager);
                }, ['l1|l2|l3', 'l4 -l1']);
            };
            var testSelects = function(manager) {//Test selects by tags and sorting
                var note1 = {text: 'Note1', tags: ['l1', 'l2']};
                var note2 = {text: 'Note2', tags: ['l2', 'l3']};
                var note3 = {text: 'Note3', tags: ['l3', 'l4']};
                manager.putNote(note1, function(id) {
                    ok(id);
                    manager.putNote(note2, function(id) {
                        ok(id);
                        manager.putNote(note3, function(id) {
                            ok(id);
                            manager.selectNotes('l1|l2', function(list) {//Selected
                                equal(list.length, 2, 'l1|l2');
                                manager.selectNotes('l1 l4', function(list) {//
                                    equal(list.length, 0, 'l1 l4');
                                    manager.selectNotes('l2 l1|l3', function(list) {//
                                        equal(list.length, 2, 'l2 l1|l3');
                                        if (list.length == 2) {
                                            equal(list[0].text, 'Note1', 'Note1');
                                            equal(list[1].text, 'Note2', 'Note2');
                                        };
                                        manager.loadTags(list, function(list) {//Adds tags
                                            equal(list.length, 2, 'length 2');
                                            if (list.length == 2) {
                                                ok(list[0].tags);
                                                ok(list[1].tags);
                                                equal(list[0].tags.length, 2, 'length 2');
                                                equal(list[1].tags.length, 2, 'length 2');
                                                equal(list[0].tags_captions.length, 2, 'length 2');
                                                equal(list[1].tags_captions.length, 2, 'length 2');
                                            };
                                            manager.selectNotes('l1|l2|l3', function(list) {//
                                                equal(list.length, 3, 'l2|l1|l3');
                                                manager.loadTags(list, function(list) {//Adds tags
                                                    equal(list.length, 3, 'length 3');
                                                    var sorted = manager.sortNotes(list, '+l4 -l3');
                                                    equal(sorted.length, 3);
                                                    if (sorted.length == 3) {//
                                                        equal(sorted[0].text, 'Note3');
                                                        equal(sorted[1].text, 'Note1');
                                                        equal(sorted[2].text, 'Note2');
                                                        sorted = manager.sortNotes(list, 'l4');
                                                        equal(sorted[0].text, 'Note3');
                                                        equal(sorted[1].text, 'Note1');
                                                        equal(sorted[2].text, 'Note2');
                                                        sorted = manager.sortNotes(list, 'l2 l3');
                                                        equal(sorted[0].text, 'Note2');
                                                        equal(sorted[1].text, 'Note1');
                                                        equal(sorted[2].text, 'Note3');
                                                        sorted = manager.sortNotes(list, '-l*');
                                                        equal(sorted[0].text, 'Note1');
                                                        equal(sorted[1].text, 'Note2');
                                                        equal(sorted[2].text, 'Note3');
                                                        sorted = manager.sortNotes(list, '+l*');
                                                        equal(sorted[0].text, 'Note1');
                                                        equal(sorted[1].text, 'Note2');
                                                        equal(sorted[2].text, 'Note3');
                                                    };
                                                    manager.selectNotes('l2|l3 !l4', function(list) {
                                                        equal(list.length, 2, 'l2|l3 !l4');
                                                        manager.removeNote(sorted[0].id, function(id, err) {
                                                            ok(id);
                                                            manager.selectNotes('l1|l2|l3', function(list) {
                                                                equal(list.length, 2);
                                                                testProxy(manager);
                                                            });
                                                        });
                                                    });
                                                })
                                            });
                                        })
                                    });
                                });
                            });
                        })
                    })
                })
            };
            var testDrops = function(manager) {//Test note drop
                //Create sheet, drop note on it
                var tags = manager.noteToSheet('+tag1 tag2 -tag3', ['tag1', 'tag3', 'tag4']);
                ok(tags);
                deepEqual(tags, ['tag1', 'tag4', 'tag2']);
                tags = manager.noteToSheet('+tag1 -tag*', ['tag1', 'tag3', 'tag4', 'atag']);
                deepEqual(tags, ['atag', 'tag1']);
                tags = manager.noteToSheet('-* +tag1', ['tag1', 'tag3', 'tag4', 'atag']);
                deepEqual(tags, ['tag1']);
                //Drop of tags
                tags = manager.tagToNote(['tag1', 'tag2'], 'tag1');
                deepEqual(tags, ['tag1', 'tag2']);
                tags = manager.tagToNote(['tag1', 'tag2'], 'tag3');
                deepEqual(tags, ['tag1', 'tag2', 'tag3']);
                tags = manager.tagToTag(['tag1', 'tag2'], 'tag2', 'tag3');
                deepEqual(tags, ['tag1', 'tag3']);
                tags = manager.tagToTag(['tag1', 'tag2', 'tag3'], 'tag1', 'tag2');
                deepEqual(tags, ['tag3', 'tag2']);
                testSelects(manager);
            };
            var testNotes = function(manager) {//
                manager.updateNote(null, 'Text', null, function(id) {//Note added
                    ok(id, 'Note added');
                    manager.updateNote(id, 'Text2', null, function(id2) {//Note updated
                        equal(id, id2, 'Note updated');
                        manager.updateNote(id, 'http://', 'link', function(id3) {//Link updated
                            equal(id, id3, 'Notes are OK');
                            var note = {tags: ['tag1', 'tag2']};
                            manager.updateTags(id, [], function(id) {//Saved
                                ok(id, 'Saved no tags');
                                manager.getTags(id, function(arr) {//Get tags
                                    equal(arr.length, 1, 'no-tags');
                                    manager.updateTags(id, note.tags, function(id) {
                                        ok(id, 'Saved tags: '+note.tags);
                                        manager.getTags(id, function(arr) {
                                            equal(arr.length, 2, 'Tags loaded');
                                            testDrops(manager);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            };
            var manager = new DataManager(db);
            manager.open(function(manager) {//
                ok(manager, 'Opened');
                if (manager) {//Do other tests
                    manager.addSheet(function(id, err) {//New sheet added
                        ok(id, 'ID is OK: '+id);
                        manager.updateSheet(id, {title: 'Title', group: 'Group', ref: 'Ref', tags: 'tag, tag', sort: 'tag', display: 'default'}, function(id, err) {
                            ok(id, 'Id after update is OK: '+err);
                            manager.getSheets(function(list) {
                                ok(list);
                                if (list) {//
                                    equal(list.length, 1);
                                    if (list.length>0) {//
                                        equal(list[0].id, id);
                                        equal(list[0].title, 'Title');
                                        equal(list[0].ref, 'Ref');
                                        equal(list[0].tags, 'tag, tag');
                                        equal(list[0].sort, 'tag');
                                        equal(list[0].display, 'default');
                                        equal(list[0].visible, 0);
                                    };
                                    manager.addSheet(function(id) {//Another sheet
                                        ok(id);
                                        manager.getSheets(function(list, err) {//List
                                            ok(list);
                                            equal(list.length, 2);
                                            var sorted = manager.lineupSheets(list);
                                            equal(sorted.length, 2);
                                            equal(sorted[0].caption, 'Untitled');
                                            equal(sorted[0].type, 'sheet');
                                            equal(sorted[1].caption, 'Group');
                                            equal(sorted[1].type, 'group');
                                            sorted = manager.lineupSheets(list, 'Group');
                                            equal(sorted.length, 3);
                                            equal(sorted[0].caption, 'Untitled');
                                            equal(sorted[0].type, 'sheet');
                                            equal(sorted[1].caption, 'Group');
                                            equal(sorted[1].type, 'group');
                                            equal(sorted[2].caption, 'Title');
                                            equal(sorted[2].type, 'sheet');
                                            manager.removeSheet(sorted[0].id, function(id) {//Removed
                                                ok(id, 'Sheet removed'),
                                                manager.getSheets(function(list) {//
                                                    equal(list.length, 1);
                                                    testNotes(manager);
                                                });
                                            })
                                        });
                                    });
                                } else {//Error
                                    start();
                                };
                            });
                        })
                    });
                } else {//Stop
                    start();
                };
            });
        }, function() {//
            ok(false, 'Open error');
            start();
        });
    });
};
var _testDBox = function() {//DropBox
    module('DropBox');
    test('String tests', function() {
        ok('0102'<'0103');
        ok('0103'>'0102');
        ok('0201'>'0103');
    });
    test('OAuth tests', function() {
        stop();
        var dbox = new DropBox('ax8q7hg8dkrk83v', 'myblmd09laog4fo');
        dbox.getTokens('vorobev@gmail.com', '8d8X4Q9620HX57Y8', function(tokens) {//
            ok(tokens, 'tokens done');
            ok(tokens.token, 'token ok');
            ok(tokens.secret, 'secret ok');
            dbox.fileInfo('sstack.db', function(data, error) {//No such file
                ok(!data, 'No such file');
                ok(error, error);
                dbox.fileInfo('pass.kdb', function(data) {//Have file
                    ok(data, 'pass.kdb exists')
                    equals(data? data.bytes: 0, 19100, 'pass.kdb size');
                    dbox.upload('C:\\Home\\1.txt', 'android/1.rtf', function(data, error) {
                        ok(data, 'File uploaded');
                        ok(!error, error);
                        equals(data? data.bytes: 0, 5, 'Upload size');
                        dbox.upload('C:\\Home\\2.txt', '2.txt', function(data, error) {
                            ok(!data, 'File not uploaded');
                            ok(error, error);
                            dbox.download('1.rtf', 'c:\\temp\\1.txt', function(data, error) {
                                ok(data, 'Download OK');
                                ok(data.exists, 'File exist');
                                equals(data.name, '1.txt', 'File name OK');
                                ok(!error, 'No error');
                                dbox.download('2.rtf', 'c:\\temp\\2.rtf', function(data, error) {
                                    ok(!data, 'Download failed');
                                    ok(error, error);
                                    start();
                                });
                            });
                        });
                    });
                })
            })
        });
    });
    test('Oauth test fail', function() {
        stop();
        var dbox = new DropBox('ax8q7hg8dkrk83v', 'myblmd09laog4fo');
        dbox.getTokens('vorobev@gmail.com', '8d8X4Q9620HX57Y81', function(tokens, error) {//
            ok(!tokens, 'tokens are null');
            ok(error, error);
            start();
        });
    });
    test('Oauth test datetime', function() {
        stop();
        var dbox = new DropBox('ax8q7hg8dkrk83v', 'myblmd09laog4fo');
        dbox.getTokens('vorobev@gmail.com', '8d8X4Q9620HX57Y8', function(tokens) {//
            ok(tokens, 'tokens done');
            dbox.fileInfo('1.rtf', function(data) {//Have file
                ok(data, 'File exists')
                ok(data.modified, data.modified);
                ok(new Date(data.modified), new Date(data.modified));
                dbox.detectSync('1.rtf', 'C:\\Home\\main.html', function(result) {//Compared
                    ok(result, 'Got result: '+result);
                    ok(result>0, 'dbox is new');
                    dbox.detectSync('2.rtf', 'C:\\Home\\main.html', function(result) {//Compared
                        ok(result, 'Got result: '+result);
                        ok(result<0, 'local is new (no dbox)');
                        dbox.detectSync('1.rtf', 'C:\\Home\\main2.html', function(result) {//Compared
                            ok(result, 'Got result: '+result);
                            ok(result>0, 'dbox is new (no local)');
                            dbox.detectSync('1.rtf', 'C:\\Home', function(result) {//Compared
                                ok(!result, 'Error - directory');
                                dbox.detectSync('android', 'C:\\Home\\main.html', function(result) {//Compared
                                    ok(!result, 'Error - directory');
                                    dbox.detectSync('2.rtf', 'C:\\Home\\main2.html', function(result) {//Compared
                                        ok(result<0, 'Both don\'t exists, but local is better');
                                        start();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};

