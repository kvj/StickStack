var tagDDType = 'sstack/tag';
var noteDDType = 'sstack/note';

var _buildIcon = function(name, cl) {//Builds img html
    return '<div class="icon'+(cl? ' '+cl: '')+'" style="background-image: url(\'img/icons/'+name+'.png\');"/>';
};

var Sheet = function(sheet, element, proxy) {//
    this.data = sheet;
    this.root = element;
    this.proxy = proxy;
    this.areaPanel = $('<div/>').addClass('area_wrap').appendTo(this.root).hide();
    this.area = $('<textarea/>').addClass('form_control').appendTo(this.areaPanel);
    this.area.autoGrow(10);
    this.area.bind('keydown', _.bind(function(e) {
        if (e.which == 13) {//Enter
            var val = this.area.val() || '';
            if (_.endsWith(val, '\n') || e.ctrlKey) {//Double enter or Ctrl enter - finish
                this.area.val('');
                this.area.blur();
                this.editAreaDone(_.trim(val));
                return false;
            };
        };
        return true;
    }, this));
    this.area.bind('keyup', _.bind(function(e) {
        this.updated();
        return true;
    }, this));
    this.textPanel = $('<div/>').addClass('input_wrap').appendTo(this.root).hide();
    this.text = $('<input type="text"/>').addClass('form_control').appendTo(this.textPanel);
    this.text.bind('keydown', _.bind(function(e) {
        if (e.which == 13) {//Enter
            this.editTextDone(this.text.val());
            return false;
        };
        return true;
    }, this))
    this.editing = false;
    this.selected = null;
    this.reload();
};

Sheet.prototype.editTextDone = function(val) {//Edit tag/link/ref
    var method = null;
    if (this.editField == 'tag') {
        method = 'addTag';
        val = _.trim((val || '').toLowerCase());
        this.proxy(method, _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [this.editID, val]);
    } else {
        val = _.trim(val || '');
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [this.editID, val, this.editField]);
    };
    this.text.val('');
    this.text.blur();
};

Sheet.prototype.editAreaDone = function(val) {//Creates new note
    if (this.editID) {//Edit existing
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [this.editID, val]);
    } else {//Create new
        this.proxy('createNote', _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [val, this.data.autotags+(this.newTags? ' '+this.newTags: '')]);
    };
};

Sheet.prototype.showTag = function(note, t, parent, remove) {//
    var tag = $('<span/>').addClass('note_tag draggable').attr('draggable', 'true').appendTo(parent);
    if (t.color) {//Have color
        tag.css('background-color', t.color);
    };
    tag.text(t.caption);
    tag.bind('dblclick', {tag: t}, _.bind(function(e) {
        e.preventDefault();
        this.newNote(t.id);
        return false;
    }, this));
    tag.bind('click', {div: tag, tag: t}, _.bind(function(e) {//
        //e.data.div.siblings('.note_tag').find('.note_button').hide();
        //e.data.div.find('.note_button').show();
        if (note.selectedTag == t && CURRENT_PLATFORM_MOBILE) {//Show menu
            new PopupMenu({
                element: this.root,
                items: [{
                    caption: 'Select notes',
                    handler: _.bind(function() {
                        this.proxy('openTag', null, [t.id]);
                        return true;
                    }, this),
                }, {
                    caption: 'Remove tag',
                    handler: _.bind(function() {
                        this.proxy('removeTag', _.bind(function(id, err) {//
                            if (id) {
                                this.reload();
                            };
                        }, this), [note.id, t.id]);
                        return true;
                    }, this),
                }, {
                    caption: 'Create note',
                    handler: _.bind(function() {
                        this.newNote(t.id);
                        return true;
                    }, this),
                }]
            });
        };
        note.selectedTag = t;
        if (remove) {//
            note.tagDelete.show();
        } else {
            note.tagDelete.hide();
        };
        note.div.find('.note_tag').removeClass('note_tag_selected');
        e.data.div.addClass('note_tag_selected');
        this.updated();
        if (e.ctrlKey) {
            this.proxy('openTag', null, [e.data.tag.id]);
        };
        return false;
    }, this));
    tag.bind('dragstart', {tag: t}, _.bind(function(e) {//
        dd.setDDTarget(e, tagDDType, e.data.tag.id);
        e.stopPropagation();
        return true;
    }, this));
    this.enableNoteDrop(tag, _.bind(function(n) {
        if (n.id) {//Add this tag to note
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [n.id, t.id]);
        } else {//Create note with tag
            this.proxy('putNote', _.bind(function(id, err) {
                if (id) {
                    this.proxy('addTag', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [id, t.id]);
                };
            }, this), [n]);
        };
    }, this))
    //tag.bind('dragenter', _.bind(function(e) {
        //log('tag drag enter', dd.hasDDTarget(e, tagDDType));
        //if (dd.hasDDTarget(e, tagDDType)) {
            //e.preventDefault();
        //};
    //}, this));
    tag.bind('dragover', _.bind(function(e) {
        //log('tag drag over', dd.hasDDTarget(e, tagDDType));
        if (dd.hasDDTarget(e, tagDDType)) {
            e.preventDefault();
        };
    }, this));
    tag.bind('drop', {note: note, tag: t}, _.bind(function(e) {
        var drop = dd.getDDTarget(e, tagDDType);
        if (drop) {
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [e.data.note.id, e.data.tag.id, drop]);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.editNote = function(note, div) {
    this.editID = note.id;
    this.areaPanel.detach().insertAfter(div);
    this.areaPanel.show();
    this.editing = true;
    this.area.val(note.text || '').focus();
    this.updated();
};

Sheet.prototype.enableNoteDrop = function(div, handler) {//Called when note or text is dropped
    var filesDD = 'application/x-vnd.adobe.air.file-list';
    var ctrlKey = false;
    div.bind('dragover', _.bind(function(e) {
        ctrlKey = e.ctrlKey;
        if (dd.hasDDTarget(e, noteDDType)) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, 'text/uri-list')) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, filesDD)) {
            e.preventDefault();
        };
    }, this)).bind('drop', _.bind(function(e) {//Dropped
        var drop = dd.getDDTarget(e, noteDDType);
        if (drop) {//Only ID - note drop
            log('Dropped note', drop);
            handler({id: drop});
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        drop = dd.getDDTarget(e, 'text/uri-list');
        if (drop) {//URL - new note
            var text = dd.getDDTarget(e, 'text/html');
            if (text) {
                text = $(text).text();
            };
            if (!text) {
                text = dd.getDDTarget(e, 'text/plain') || drop;
            };
            log('Dropped link', text, drop);
            handler({text: text, link: drop});
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        drop = dd.getDDTarget(e, filesDD);
        if (drop) {//URL - new note
            //log('Drop file', e.ctrlKey, e.shiftKey, ctrlKey, e.originalEvent.dataTransfer.dropEffect);
            if (ctrlKey) {//Copy links
                for (var i = 0; i < drop.length; i++) {//Copy and create file
                    var f = drop[i];
                    log('Dropped file link', f.nativePath);
                    handler({text: f.name, link: f.nativePath});
                };
            } else {//Copy files
                var files = this.proxy('copyFile', drop);
                if (!files) {
                    log('File copy error');
                    return false;
                };
                for (var i = 0; i < files.length; i++) {//
                    log('Dropped file storage', files[i].text);
                    handler(files[i]);
                };
            };
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        drop = dd.getDDTarget(e, 'text/html');
        if (drop) {
            drop = $(drop).text();
        };
        if (drop) {
            drop = dd.getDDTarget(e, 'text/plain');
        };
        if (drop && _.trim(drop)) {
            log('Dropped text', drop);
            handler({text: _.trim(drop)});
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.showNote = function(note, parent) {//
    var div = $('<div/>').addClass('note draggable').appendTo(parent);
    if (note.color) {//Have color
        div.css('background-color', note.color);
    };
    note.div = div;
    div.bind('dblclick', {note: note, div: div}, _.bind(function(e) {
        this.editNote(note, div);
        e.preventDefault();
        return false;
    }, this));
    div.bind('click', {div: div}, _.bind(function(e) {//
        if (e.ctrlKey) {//Open tag
            this.proxy('openTag', null, ['n:'+note.id]);
            return false;
        };
        this.areaPanel.hide();
        this.textPanel.hide();
        this.editing = false;
        if (this.selected == note && CURRENT_PLATFORM_MOBILE) {//Show menu
            var items = [{
                caption: 'Edit note',
                handler: _.bind(function() {//
                    this.editNote(note, div);
                    return true;
                }, this),
            }, {
                caption: 'Remove note',
                handler: _.bind(function() {
                    this.proxy('removeNote', _.bind(function(id, err) {//Removed
                        if (id) {
                            this.reload();
                        };
                    }, this), [note.id]);
                    return true;
                }, this),
            }, {
                caption: 'Add tag',
                handler: _.bind(function() {
                    this.startTextEdit(note.id, div, 'tag');
                    return true;
                }, this),
            }];
            if (note.link) {
                items.push({
                    caption: 'Open link',
                    handler: _.bind(function() {
                        this.proxy('openLink', _.bind(function(res) {
                        }, this), [note.link]);
                    }, this),
                });
            };
            new PopupMenu({
                element: this.root,
                items: items,
            });
        };
        this.selected = note;
        note.selectedTag = null;
        div.find('.note_tag').removeClass('note_tag_selected');
        note.tagDelete.hide();
        this.root.find('.note_line_show').removeClass('note_line_show');
        e.data.div.find('.note_line_hide').addClass('note_line_show');
        this.updated();
        return false;
    }, this));
    div.bind('dragover', {note: note}, _.bind(function(e) {
        if (dd.hasDDTarget(e, tagDDType)) {
            e.preventDefault();
        };
        //if (dd.hasDDTarget(e, noteDDType)) {
            //e.preventDefault();
        //};
    }, this));
    div.bind('drop', {note: note}, _.bind(function(e) {
        var drop = dd.getDDTarget(e, tagDDType);
        if (drop) {
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [e.data.note.id, drop]);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        //var drop = dd.getDDTarget(e, noteDDType);
        //if (drop) {
            //this.proxy('addTag', _.bind(function(id, err) {//
                //if (id) {
                    //this.reload();
                //};
            //}, this), [e.data.note.id, 'n:'+drop]);
            //e.stopPropagation();
            //e.preventDefault();
            //return false;
        //};
    }, this));
    this.enableNoteDrop(div, _.bind(function(n) {
        if (n.id) {//
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [note.id, 'n:'+n.id]);
        } else {//put note and add tag
            this.proxy('putNote', _.bind(function(id, err) {
                if (id) {
                    this.proxy('addTag', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [note.id, 'n:'+id]);
                };
            }, this), [n]);
        };
    }, this));
    div.bind('dragstart', {note: note}, _.bind(function(e) {//
        dd.setDDTarget(e, noteDDType, e.data.note.id);
    }, this));
    var tags = $('<div/>').addClass('note_tags').appendTo(div);
    var menu = $('<div/>').addClass('note_menu note_line_hide').appendTo(div);
    $(_buildIcon('tag')).addClass('note_button').appendTo(menu).bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
        this.startTextEdit(e.data.note.id, e.data.div, 'tag');
        return false;
    }, this));
    note.tagDelete = $(_buildIcon('tag_delete')).addClass('note_button').appendTo(menu).bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
        //Remove tag
        if (note.selectedTag) {
            this.proxy('removeTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload();
                };
            }, this), [note.id, note.selectedTag.id]);
        };
        return false;
    }, this)).hide();
    $(_buildIcon('link')).addClass('note_button').appendTo(menu).bind('click', _.bind(function(e) {//Add tag
        this.startTextEdit(note.id, div, 'link', note.link);
        return false;
    }, this));
    $(_buildIcon('bin')).addClass('note_button').appendTo(menu).bind('click', {note: note}, _.bind(function(e) {//Delete
        this.proxy('removeNote', _.bind(function(id, err) {//Removed
            if (id) {
                this.reload();
            };
        }, this), [e.data.note.id]);
        return false;
    }, this));
    $('<div style="clear: both;"/>').appendTo(div);
    var text = $('<div/>').addClass('note_text').appendTo(div);
    var lines = note.parsed || [];
    for (var j = 0; j < lines.length; j++) {//Add lines
        var line = lines[j];
        var line_div = $('<div/>').addClass('note_line').appendTo(text);
        if (line.length == 0) {//Add text
            line_div.text('-');
        };
        if (note.link && j == 0) {//Prepend link
            $(_buildIcon('link_button')).addClass('link_button').appendTo(line_div).bind('click', _.bind(function(e) {
                this.proxy('openLink', _.bind(function(res) {
                }, this), [note.link, e.ctrlKey]);
                return false;
            }, this));
        };
        for (var k = 0; k < line.length; k++) {//Add words
            var word = line[k];
            if (word.type == 'text') {//Add word
                $('<span/>').addClass('note_word').appendTo(line_div).text(''+word.text+' ');
            } else if (word.type == 'checkbox') {
                var cbox = $('<input type="checkbox"/>').addClass('note_checkbox').appendTo(line_div).attr('checked', word.checked);
                cbox.bind('change', {note: note, box: word}, _.bind(function(e) {
                    var new_text = e.data.note.text.substr(0, e.data.box.at)+(e.data.box.checked? '[ ]': '[X]')+e.data.note.text.substr(e.data.box.at+3);
                    this.proxy('editNoteField', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [e.data.note.id, new_text]);
                }, this));
                $('<span/>').addClass('note_word').appendTo(line_div).text(' ');
            } else if (word.type == 'tag') {//Add tag
                this.showTag(note, word.tag, line_div);
                $('<span/>').addClass('note_word').appendTo(line_div).text(' ');
            };
        };
    };
    if (note.display == 'none') {//Hide lines
        text.find('.note_line').addClass('note_line_hide');
        tags.addClass('note_line_hide');
    };
    if (note.display == 'notags') {//Hide lines
        tags.addClass('note_line_hide');
    };
    if (note.display == 'title') {//Hide all except first line
        text.find('.note_line').not(text.find('.note_line').first()).addClass('note_line_hide');
    };
    for (var j = 0; j < note.tags_captions.length; j++) {//Display tags
        var t = _.clone(note.tags_captions[j]);
        this.showTag(note, t, tags, true);

    };
    $('<div style="clear: both;"/>').appendTo(div);
};

Sheet.prototype.reload_default = function(list) {//
    this.root.children('.note').remove();
    for (var i = 0; i < list.length; i++) {//
        this.showNote(list[i], this.root);
    };
    this.updated();
};

Sheet.prototype.reload_day = function(list) {//
    this.startHour = 0;
    this.endHour = 23;
    this.root.find('.note').remove();
    if (!this.hours) {//Create hours
        this.hours = [];
        this.noHour = $('<div/>').appendTo(this.root);
        for (var i = this.startHour; i <= this.endHour; i++) {//Create divs
            var hr = $('<div/>').addClass('day_hour').appendTo(this.root);
            $('<div/>').addClass('day_hour_caption').appendTo(hr).text(''+(i>12? i-12: i)+(i>11? 'p': 'a'));
            this.hours[i] = hr;
            $('<div/>').addClass('day_hour_notes').appendTo(hr);
            if (CURRENT_PLATFORM_MOBILE) {
                installSwipeHandler(hr, _.bind(function(hour) {//
                    this.newNote('t:'+(hour*100));
                    return false;
                }, this), i);
            };
            hr.bind('dragover', _.bind(function(e) {
                if (dd.hasDDTarget(e, tagDDType)) {
                    e.preventDefault();
                };
                //if (dd.hasDDTarget(e, noteDDType)) {
                    //e.preventDefault();
                //};
            }, this));
            hr.bind('drop', {hour: i}, _.bind(function(e) {
                var drop = dd.getDDTarget(e, tagDDType);
                if (drop) {
                    //this.newNote(drop+' t:'+(e.data.hour*100));
                    this.proxy('createNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this), [null, this.data.autotags+' '+drop+' t:'+(e.data.hour*100)]);
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                };
                //drop = dd.getDDTarget(e, noteDDType);
                //if (drop) {
                    //this.proxy('moveNote', _.bind(function(id, err) {//
                        //if (id) {
                            //this.reload();
                        //};
                    //}, this), [drop, this.data.autotags+' -t:* t:'+(e.data.hour*100)]);
                    //e.stopPropagation();
                    //e.preventDefault();
                    //return false;
                //};
            }, this));
            this.enableNoteDrop(hr, _.bind(function(n) {
                if (n.id) {//Note
                    this.instance.proxy('moveNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this.instance), [n.id, this.instance.data.autotags+' -t:* t:'+(this.hour*100)]);
                } else {
                    this.instance.proxy('putNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload();
                        };
                    }, this.instance), [n, this.instance.data.autotags+' t:'+(this.hour*100)]);
                };
            }, {instance: this, hour: i}));
            hr.bind('dblclick', {hour: i}, _.bind(function(e) {
                this.newNote('t:'+(e.data.hour*100));
                e.preventDefault();
                return false;
            }, this));
            hr.bind('click', _.bind(function(e) {//
                if (this.editing) {//
                    return true;
                };
                this.areaPanel.hide();
                this.textPanel.hide();
                this.editing = false;
                this.root.find('.note_line_show').removeClass('note_line_show');
                this.updated();
            }, this));
        };
        this.nowLine = $('<div/>').appendTo(this.root).addClass('now_line');
        setInterval(_.bind(this.moveNowLine, this), 60*1000);
    };
    for (var i = 0; i < list.length; i++) {//
        var target = this.hours[list[i].hour];
        this.showNote(list[i], target? target.children('.day_hour_notes'): this.noHour);
    };
    this.moveNowLine();
    this.updated();
};

Sheet.prototype.moveNowLine = function() {//Moves now line
    var dt = new Date();
    var div = this.hours[dt.getHours()];
    if (div) {
        div.prepend(this.nowLine);
        this.nowLine.css('top', Math.floor(div.height()*dt.getMinutes()/60)).show();
    } else {
        this.nowLine.hide();
    };
};

Sheet.prototype.reload = function() {//Asks for items
    this.areaPanel.hide();
    this.textPanel.hide();
    this.editing = false;
    this.proxy('loadNotes', _.bind(function(list, err) {//
        if (list) {//Display list
            var mode = this.data.display || 'default';
            if (this['reload_'+mode]) {//Have reload
                this['reload_'+mode].call(this, list);
            };
        };
    }, this), [this.data.tags, this.data.sort]);
};

Sheet.prototype.startTextEdit = function(id, note, field, value) {//Shows editor
    this.editing = true;
    this.textPanel.detach().insertAfter(note);
    this.textPanel.show();
    this.text.val(value || '').focus();
    this.editID = id;
    this.editField = field;
    this.updated();
};

Sheet.prototype.newNote = function(tags) {//Starts new note
    this.editing = true;
    this.newTags = tags;
    this.root.prepend(this.areaPanel.detach());
    this.areaPanel.show();
    this.area.val('').focus();
    this.editID = null;
    this.updated();
};

Sheet.prototype.updated = function() {//Empty
};

Sheet.prototype.close = function(handler) {
    if (!this.data.id) {//No ID
        handler();
    } else {//
        this.proxy('closeSheet', _.bind(function(id) {
            handler();
        }, this), [this.data.id]);
    };
};

Sheet.prototype.move = function(x, y) {
    if (this.data.id) {//ID
        this.data.x = x;
        this.data.y = y;
        this.proxy('moveSheet', _.bind(function(id, err) {
        }, this), [this.data.id, x, y]);
    };
};
