var tagDDType = 'sstack/tag';
var noteDDType = 'sstack/note';
var timeDDType = 'sstack/time';

var _buildIcon = function(name, cl) {//Builds img html
    return '<div class="icon'+(cl? ' '+cl: '')+'" style="background-image: url(\'img/icons/'+name+'.png\');"/>';
};

var Sheet = function(sheet, element, proxy, menuPlace, panel) {//
    this.data = sheet;
    this.panel = panel;
    this.panel.wide = false;
    this.autotags = this.data.autotags;
    this.canToggleWide = true;
    if (!this.autotags && this.data.id) {
        this.autotags = 's:'+this.data.id+' ';
    };
    this.tagConfig = {};
    this.root = element;
    this.topDiv = $(document.createElement('div')).appendTo(this.root);
    this.dropTargetsDiv = $(document.createElement('div')).appendTo(this.topDiv).hide();
    this.dropTargets = new Buttons({
        root: this.dropTargetsDiv,
        maxElements: 3,
        readonly: true
    });
    var copyButton = this.dropTargets.addButton({
        caption: 'Copy here'
    });
    var moveButton = this.dropTargets.addButton({
        caption: 'Move here'
    });
    var importButton = this.dropTargets.addButton({
        caption: 'Import here'
    });
    this.enableTagDrop(copyButton.element, _.bind(function(tag, text) {
        this.startNoteWithTag({tags_captions: []}, tag);
    }, this));
    this.enableNoteDrop(copyButton.element, _.bind(function(n, e) {
        if (n.id) {//note drop
            var autotags = this.autotags;
            this.proxy('moveNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload(id);
                };
            }, this), [n.id, autotags]);
        } else {//Put note
            this.proxy('putNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload(id);
                };
            }, this), [n, this.autotags]);
        };
    }, this));
    this.enableNoteDrop(moveButton.element, _.bind(function(n, e) {
        if (n.id) {//note drop
            var sheetType = this.data.type;
            var autotags = this.autotags;
            if (sheetType) {
                autotags = '-'+sheetType+'* '+autotags;
            };
            this.proxy('moveNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload(id);
                };
            }, this), [n.id, autotags]);
        };
    }, this));
    this.enableNoteDrop(importButton.element, _.bind(function(n, e) {
        // log('Drop to import', n);
        if (n.id) {//note drop
            this.proxy('getNote', _.bind(function (err, note) {
                if (!err) {
                    this.proxy('createNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(id);
                        };
                    }, this), [note.text, this.autotags]);
                } else {
                    _showInfo('Note not found');
                }
            }, this), [n.id]);
        } else {
            this.proxy('putNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload(id);
                };
            }, this), [n, this.autotags]);            
        }
    }, this));
    this.proxy = proxy;
    this.mediaGap = 8;
    this.menuPlace = menuPlace;
    this.areaPanel = $(document.createElement('div')).addClass('area_wrap').appendTo(this.root).hide();
    this.area = $('<textarea/>').addClass('form_control').appendTo(this.areaPanel);
    this.area.bind('click', function (e) {
        e.stopPropagation();
        return true;
    });
    this.area.autoGrow(10);
    var menuDiv = $(document.createElement('div')).addClass('sheet_menu').appendTo(this.root).hide();
    this.menu = new Buttons({
        root: menuDiv,
        rows: [0, '2.5em'],
        maxElements: 3,
        safe: true,
    });
    this.menu.addButton({
        caption: '+ Tag',
        classNameInner: 'button_create',
        handler: _.bind(function() {//Add tag
            this.startTextEdit(this.selected.id, this.selected.div, 'tag');
        }, this)
    });
    this.menu.addButton({
        caption: 'Edit',
        handler: _.bind(function() {//Edit note
            this.editNote(this.selected, this.selected.div);
        }, this)
    });
    this.menu.addButton({
        caption: 'Remove',
        classNameInner: 'button_remove',
        handler: _.bind(function() {//
            this.removeNote(this.selected);
        }, this)
    });
    this.menu.addButton({
        caption: '|',
        width: 3,
        row: 1,
        handler: _.bind(function() {//
            this.showNoteMenu();
            return true;
        }, this)
    });
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
    this.textPanel = $(document.createElement('div')).addClass('input_wrap').appendTo(this.root).hide();
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
    this.expandedNotes = {};
    $(document.createElement('div')).addClass('clear').appendTo(this.root);
    this.extra = {};
    this.display = this.data.display || 'default';
    if (this.display.indexOf(':') != -1) {
        var index = this.display.indexOf(':');
        this.displayConfig = this.display.substr(index+1);
        this.display = this.display.substr(0, index);
    };
    if (this['prepare_'+this.display]) {
        this['prepare_'+this.display].call(this);
    };
    this.reload();
};

Sheet.prototype.removeNote = function(note) {
    if (note.selectedTag) {
        _showQuestion('Remove tag?', _.bind(function (index) {
            if (0 == index) {
                this.proxy('removeTag', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(note.id);
                    };
                }, this), [note.id, note.selectedTag.id]);
            };
        }, this))
    } else {
        _showQuestion('Remove note?', _.bind(function (index) {
            if (0 == index) {
                this.proxy('removeNote', _.bind(function(id, err) {//Removed
                    if (id) {
                        this.reload();
                    };
                }, this), [note.id]);
            };
        }, this));                
    }
    this.updated();    
};


Sheet.prototype.toggleWide = function() {
    if (this.canToggleWide) {
        this.panel.wide = !this.panel.wide;
        this.panel.onPanelChanged();
        return true;
    };
    return false;
};

Sheet.prototype.onSheetMenu = function(items) {
    items.push({
        caption: 'Toggle drop targets',
        handler: _.bind(function() {
            this.dropTargetsDiv.toggle();
            this.updated();
            return true;
        }, this),
    });
    if (this.canToggleWide) {
        items.push({
            caption: 'Toggle wide panel',
            handler: _.bind(function() {
                this.toggleWide();
                return true;
            }, this),
        });        
    };
};

Sheet.prototype.showNoteMenu = function() {
    var items = [];
    if (this.selected && this.selected.selectedTag) {
        items.push({
            caption: 'Edit tag',
            handler: _.bind(function() {
                this.startTextEdit(this.selected.id, this.selected.div, 'tag', this.selected.selectedTag.id);
                return true;
            }, this),
        });
        items.push({
            caption: 'Note from tag',
            handler: _.bind(function() {
                this.startNoteWithTag(this.selected, this.selected.selectedTag.id);
                return true;
            }, this),
        });
        //createBookmark
        items.push({
            caption: 'Select tag',
            handler: _.bind(function() {
                this.proxy('openTag', null, [this.selected.selectedTag.id]);
                return true;
            }, this),
        });
        items.push({
            caption: 'Bookmark tag',
            handler: _.bind(function() {
                this.proxy('createBookmark', null, [this.selected.selectedTag.id]);
                return true;
            }, this),
        });
        this.launchTagMethod(this.selected, 'menu', this.selected.selectedTag.id, items);       
    };
    if (this.selected) {
        items.push({
            caption: 'Open note',
            handler: _.bind(function() {
                this.openNote(this.selected);
                return true;
            }, this),
        });
        items.push({
            caption: 'Bookmark note',
            handler: _.bind(function() {
                this.proxy('createBookmark', null, ['n:'+this.selected.id]);
                return true;
            }, this),
        });
    };
    new PopupMenu({
        element: this.menuPlace || this.root,
        items: items,
    });
    this.updated();
};

Sheet.prototype.keypress = function(e) {
    if (this.editing) {
        return true;
    };
    switch (e.keyCode) {
        case 36:
            this.moveSelection(-2);
            return false;
        case 35:
            this.moveSelection(2);
            return false;
        case 38:
            this.moveSelection(-1);
            return false;
        case 40:
            this.moveSelection(1);
            return false;
        case 37:
            this.moveTagSelection(-1);
            return false;
        case 39:
            this.moveTagSelection(1);
            return false;
        case 78:
        case 45:
            this.newNote();
            return false;
        case 32: // space
        case 113: // F2
            if (this.selected) {
                if (this.selected.selectedTag) {
                    this.startTextEdit(this.selected.id, this.selected.div, 'tag', this.selected.selectedTag.id);
                } else {
                    this.editNote(this.selected, this.selected.div);                    
                }
            };
            return false;
        case 82: //r
            if (!e.ctrlKey) {
                this.reload(this.selected? this.selected.id: null);
                return false;
            };
            break;
        case 68: // d
            if (this.selected) {
                this.removeNote(this.selected);
                return false;
            };
            break;
        case 84: //t
            if (!e.ctrlKey && this.selected) {
                this.startTextEdit(this.selected.id, this.selected.div, 'tag');
                return false;
            };
            break;
        case 77: //m
            if (!e.ctrlKey && this.selected) {
                this.showNoteMenu();
                return false;
            };
            break;
        case 69: //e
            this.toggleWide();
            return false;
        case 13:
            if (this.selected) {
                if (this.selected.selectedTag) {
                    this.proxy('openTag', null, [this.selected.selectedTag.id]);
                } else {
                    this.openNote(this.selected, e.ctrlKey? false: true);
                }
            };
            return false;
    }
    if (this['keypress_'+this.display]) {
        var result = this['keypress_'+this.display].call(this, e);
        if (false === result) {
            return result;
        };
    };
    // log('keypress', e.keyCode);
};

Sheet.prototype.moveTagSelection = function(dir) {
    if (!this.selected || this.selected.tags.length == 0) {
        return false;
    };
    for (var i = 0; i < this.selected.tag_objects.length; i++) {
        var t = this.selected.tag_objects[i];
        if (t == this.selected.selectedTag) {
            if (dir == 1 && i<this.selected.tags.length-1) {
                this.selectTag(this.selected.tag_objects[i+1]);
                return true;
            };
            if (dir == -1 && i>0) {
                this.selectTag(this.selected.tag_objects[i-1]);
                return true;
            };
        };
    };
    if (dir == -1) {
        this.selectTag(this.selected.tag_objects[this.selected.tag_objects.length-1]);
    };
    if (dir == 1) {
        this.selectTag(this.selected.tag_objects[0]);        
    };
};

Sheet.prototype.moveSelection = function(dir) {
    var notes = this.root.find('.note');
    if (!this.selected) {
        if (notes.size()>0) {
            this.selectNote(this.notes[notes.eq(0).attr('id')]);
            return true;
        } else {
            return false;
        }
    };
    if (notes.size()>0) {
        if (dir == 2) {
            // Last
            this.selectNote(this.notes[notes.eq(notes.size()-1).attr('id')]);
            return false;
        };
        if (dir == -2) {
            // First
            this.selectNote(this.notes[notes.eq(0).attr('id')]);
            return false;
        };
    };
    notes.each(_.bind(function (index, item) {
        if ($(item).attr('id') == this.selected.divID) {
            // Found
            if (dir == -1 && index>0) {
                // Move up
                this.selectNote(this.notes[notes.eq(index-1).attr('id')]);
            };
            if (dir == 1 && index<notes.size()-1) {
                // Move down
                this.selectNote(this.notes[notes.eq(index+1).attr('id')]);
            };
            return false;
        };
    }, this))
};

Sheet.prototype.launchTagMethod = function(note, method, tag) {
    for (var j = 0; j < note.tags_captions.length; j++) {//Display tags
        var t = note.tags_captions[j];
        if (tag && t.id != tag) {
            continue;
        };
        if (t.display) {
            var m = 'tag_'+method+'_'+t.display;
            if (this[m]) {
                var params = [note, t.id];
                for (var i = 3; i < arguments.length; i++) {
                    params.push(arguments[i]);
                };
                var result = this[m].apply(this, params);
                if (result) {
                    return result;
                };
            };
        };
    };
    return null;
};

Sheet.prototype.tag_start_contact = function(note, tag) {
    this.startTextEdit(null, this.topDiv, null, 'contact:', _.bind(function (text) {
        this.proxy('createNote', _.bind(function(id, err) {//
            if (id) {
                this.proxy('addTag', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(id);
                    };
                }, this), [id, text]);
            };
        }, this), ['', this.autotags]);
    }, this))
    return true;
};

Sheet.prototype.tag_get_name_contact = function(note, tag) {
    return tag.substr('contact:'.length);
};

Sheet.prototype.tag_unselect_file = function(note, tag) {
    if (note.fileCreated) {
        note.div.find('.file').remove();
        note.fileCreated = false;
    };
};

Sheet.prototype.tag_select_file = function(note, tag) {
    if (!note.fileCreated) {
        note.fileCreated = true;
        var frame = $(document.createElement('div')).addClass('file note_frame note_line_hide').appendTo(note.div);
        // log('Show file', tag);
        var name = tag.substr(2);
        if (_.endsWith(name, '.jpg')) {
            var loading = $(document.createElement('div')).addClass('file_loading').appendTo(frame).text('Loading...');
            this.proxy('getAttachment', _.bind(function (err, uri) {
                loading.remove();
                if (err) {
                    return _showInfo(err);
                };
                var img = $(document.createElement('img')).addClass('file_image note_image').appendTo(frame);
                img.bind('load', _.bind(function () {
                    var width = note.div.innerWidth()-2*this.mediaGap;
                    var iw = img.width();
                    var ih = img.height();
                    var mul = width / iw;
                    iw *= mul;
                    ih *= mul;
                    img.width(Math.floor(iw)).height(Math.floor(ih));
                    this.updated();
                }, this));
                img.attr('src', uri);
            }, this), [name]);
            
        };
    };
};


Sheet.prototype.tag_menu_geo = function(note, tag, items) {
    items.push({
        caption: 'Edit location',
        handler: _.bind(function () {
            this.proxy('editMap', _.bind(function () {
                this.reload(note.id);
            }, this), [[{
                id: note.id,
                data: tag
            }]]);
            return true;
        }, this)
    })
};

Sheet.prototype.tag_menu_sheet = function(note, tag, items) {
    items.push({
        caption: 'Open sheet',
        handler: _.bind(function () {
            this.proxy('openMap', _.bind(function () {
            }, this), [tag.substr(2)]);
            return true;
        }, this)
    })
};

Sheet.prototype.tag_click_sheet = function(note, tag) {
    this.proxy('getSheet', _.bind(function (err, sheet) {
        if (!err) {
            _showInfo(sheet.title || 'Untitled');
        };
    }, this), [tag.substr(2)]);
};

Sheet.prototype.tag_click_note = function(note, tag) {
    this.proxy('getNote', _.bind(function (err, note, list) {
        if (!err) {
            var text = '';
            if (list) {
                text = this.launchTagMethod(list[0], 'get_name');
            };
            if (!text) {
                text = note.text;
            };
            if (text.indexOf('\n') != -1) {
                text = text.substr(0, text.indexOf('\n'));
            } else {
                if (text.length>50) {
                    text = text.substr(0, 50)+'...';
                };
            }
            _showInfo(text || 'Untitled');
        };
    }, this), [tag.substr(2), true]);
};

Sheet.prototype.tag_unselect_geo = function(note, tag) {
    if (note.geoCreated) {
        note.div.find('.geo').remove();
        note.geoCreated = false;
    };
};

Sheet.prototype.tag_select_geo = function(note, tag) {
    // log('Ready to show geo', tag);
    if (!note.geoCreated) {
        var point = splitPoint(tag);
        note.geoCreated = true;
        if (point.lat && point.lon) {
            var width = note.div.innerWidth()-2*this.mediaGap;
            var height = Math.floor(width*0.75);
            var frame = $(document.createElement('div')).addClass('geo note_frame note_line_hide').appendTo(note.div);
            var img = $(document.createElement('img')).addClass('geo_image note_image').appendTo(frame);
            img.attr('src', 'http://maps.google.com/maps/api/staticmap?center='+point.lat+','+point.lon+'&zoom=15&size='+width+'x'+height+'&sensor=true&markers=color:red|size:mid|'+point.lat+','+point.lon);
            img.bind('click', _.bind(function (e) {
                var link = '';
                if (CURRENT_PLATFORM_MOBILE) {
                    link = 'geo:'+point.lat+','+point.lon;
                } else {
                    link = 'http://maps.google.com/maps?q='+point.lat+','+point.lon+'&z=18';
                };
                this.proxy('openLink', _.bind(function(res) {
                }, this), [link, e.ctrlKey]);
                return false;
            }, this))
            img.width(width).height(height);
        };
    };
};

var splitPoint = function (tag) {
    var arr = tag.split(':');
    var point = {};
    for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        var vp = item.split('=');
        if (vp.length == 2) {
            point[vp[0]] = vp[1];
        };
    };
    return point;
};

Sheet.prototype.tag_unselect_path = function(note, tag) {
    if (note.geoCreated) {
        note.div.find('.path').remove();
        note.geoCreated = false;
    };
};

Sheet.prototype.tag_build_after_ok = function(note, tag, afterStr) {
    if (tag.length>3) {
        afterStr.splice(0, 0, tag.substr(3));
    };
};

Sheet.prototype.tag_show_link = function(note, tag, div) {
    var a = $(document.createElement('a')).addClass('tag_link').appendTo(div.empty()).text('link').attr('href', '#');
    a.bind('click', _.bind(function (e) {
        if (e.shiftKey) {
            return true;
        };
        this.proxy('openLink', _.bind(function(res) {
        }, this), [tag.substr(2), e.ctrlKey]);
        return false;
    }, this))
};

Sheet.prototype.tag_menu_path = function(note, tag, items) {
    items.push({
        caption: 'Edit path',
        handler: _.bind(function () {
            this.proxy('loadNotes', _.bind(function(list, err) {//
                if (list && list.length>0) {//Display list
                    var path = [];
                    for (var i = 0; i < list.length; i++) {
                        var n = list[i];
                        var tags = n.tags || [];
                        // log('Tags', tags, n);
                        var pointTag = null;
                        for (var j = 0; j < tags.length; j++) {
                            if (_.startsWith(tags[j], 'g:')) {
                                pointTag = tags[j];
                                break;
                            };
                        };
                        if (!pointTag) {
                            continue;
                        };
                        path.push({
                            id: n.id,
                            data: pointTag
                        })
                    };
                    this.proxy('editMap', _.bind(function () {
                        this.reload(note.id);
                    }, this), [path]);
                } else {
                    _showInfo('Path not found')
                }
            }, this), ['n:'+note.id+' g:*']);
            return true;
        }, this)
    })
};

Sheet.prototype.tag_show_note_fcard = function(note, tag, text, lines) {
    var first_line = $(document.createElement('div')).addClass('note_line').appendTo(text);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var lineDiv = $(document.createElement('div')).addClass('note_line note_line_fcard').appendTo(text);
        if (this.hiddenLines && this.hiddenLines[i] && !this.showList) {
            lineDiv.addClass('note_line_hide');
        };
        if (i<lines.length-1) { // Add class to every line except last
            lineDiv.addClass('note_line_fcard'+i);
        };
        this.renderLine(note, line, lineDiv);
    };
    return true;
};

Sheet.prototype.tag_show_note_contact = function(note, tag, text, lines) {
    var first_line = $(document.createElement('div')).addClass('note_line').appendTo(text);
    $(document.createElement('div')).addClass('note_contact_title').appendTo(first_line).text(tag.substr('contact:'.length));
    var second_line = $(document.createElement('div')).addClass('note_line').appendTo(text);
    var table = $(document.createElement('div')).addClass('note_contact_table').css('display', 'table').appendTo(second_line);
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        var nameWords = [];
        var valueWords = [];
        var signFound = false;
        for (var j = 0; j < line.length; j++) {
            var word = line[j];
            if (!signFound) {
                nameWords.push(word);
                if (word.type == 'text' && _.endsWith(word.text, ':')) {
                    signFound = true;
                };
            } else {
                valueWords.push(word);
            }
        };
        var row = $(document.createElement('div')).addClass('note_contact_row').css('display', 'table-row').appendTo(table);
        var nameCell = $(document.createElement('div')).addClass('note_contact_cell note_contact_name_cell').css('display', 'table-cell').appendTo(row);
        var valueCell = $(document.createElement('div')).addClass('note_contact_cell note_contact_value_cell').css('display', 'table-cell').appendTo(row);
        this.renderLine(note, nameWords, nameCell);
        this.renderLine(note, valueWords, valueCell);
    };
    return true;
};

Sheet.prototype.tag_edit_note_contact = function(note, tag) {
    this.proxy('editContact', _.bind(function(text, name) {
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.proxy('addTag', _.bind(function(id, err) {//
                    this.reload(note.id);
                }, this), [id, tag, 'contact:'+name]);
            };
        }, this), [note.id, text]);
        this.reload(note.id);
    }, this), [note, tag]);
    return true;
};

Sheet.prototype.tag_select_path = function(note, tag) {
    // log('Ready to show geo', tag);
    if (!note.pathCreated) {
        var point = splitPoint(tag);
        note.pathCreated = true;
        var frame = $(document.createElement('div')).addClass('path note_frame note_line_hide').appendTo(note.div);
        this.proxy('loadNotes', _.bind(function(list, err) {//
            if (list && list.length>0) {//Display list
                // log('Points:', list.length);
                var path = ['color:0x0000ff', 'weight: 3'];
                for (var i = 0; i < list.length; i++) {
                    var n = list[i];
                    var tags = n.tags || [];
                    // log('Tags', tags, n);
                    var pointTag = null;
                    for (var j = 0; j < tags.length; j++) {
                        if (_.startsWith(tags[j], 'g:')) {
                            pointTag = tags[j];
                            break;
                        };
                    };
                    if (!pointTag) {
                        continue;
                    };
                    var point = splitPoint(pointTag);
                    if (point.lat && point.lon) {
                        path.push(''+point.lat+','+point.lon);
                    }
                };
                var width = note.div.innerWidth()-2*this.mediaGap;
                var height = Math.floor(width*0.75);
                var img = $(document.createElement('img')).addClass('geo_image note_image').appendTo(frame);
                img.attr('src', 'http://maps.google.com/maps/api/staticmap?size='+width+'x'+height+'&sensor=true&path='+path.join('|'));
                img.width(width).height(height);
            } else {
                _showInfo('Path not found')
            }
        }, this), ['n:'+note.id+' g:*']);
    };
};

Sheet.prototype.editTextDone = function(val) {//Edit tag/link/ref
    var method = null;
    val = _.trim(val || '');
    this.text.val('');
    this.text.blur();
    if (this.textEditHandler) {
        this.textEditHandler(val);
    };
    if (this.editField == 'tag') {
        method = 'addTag';
        var params = [this.editID];
        if (this.editValue) {
            params.push(this.editValue, val);
        } else {
            params.push(val);
        }
        this.proxy(method, _.bind(function(id, err) {//
            if (id) {
                this.reload(this.selected.id);
            };
        }, this), params);
    } else {
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.reload();
            };
        }, this), [this.editID, val, this.editField]);
    };
};

var fixFloat = function (fl, round) {
    if (!fl) {
        return 0;
    };
    if (!round) {
        return fl;
    };
    return Math.round(fl*round)/round;
};

Sheet.prototype.pointToTag = function(point) {
    return 'g:lat='+fixFloat(point.lat)+':lon='+fixFloat(point.lon)+':sp='+fixFloat(point.speed, 100)+':acc='+fixFloat(point.acc, 100)+':alt='+fixFloat(point.alt, 100)+':tstamp='+point.created;
};

Sheet.prototype.importNotes = function(provider) {
    provider.list(_.bind(function (err, list) {
        if (err) {
            return _showError(err);
        };
        var items = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            log('item', item.id, item.title);
            items.push({
                taskID: item.id,
                caption: item.title
            });
        };
        new PopupMenu({
            element: this.menuPlace || this.root,
            items: items,
            handler: _.bind(function (item) {
                // log('Getting task:', item.taskID);
                provider.get(item.taskID, _.bind(function (err, task) {
                    if (err) {
                        return _showError(err);
                    };
                    var tags = this.autotags;
                    // log('Task', task, _.keys(task));
                    if (task.created>0) {
                        var dt = new Date(task.created);
                        tags += ' d:'+dt.format('yyyymmdd')+' t:'+(dt.getHours()*100+Math.floor(dt.getMinutes()/15)*15);
                    };
                    if (task.id) {
                        delete task.id;
                    };
                    if (task.title) {
                        task.text = task.title;
                        delete task.title;
                    };
                    var media = null;
                    if (task.media) {
                        media = task.media;
                        delete task.media;
                    };
                    var points = null;
                    if (task.point) {
                        tags +=' '+this.pointToTag(task.point);
                        delete task.point;
                    };
                    if (task.points) {
                        points = task.points;
                        delete task.points;
                        tags += ' p:';
                    };
                    // log('Create note', task, tags);
                    this.proxy('putNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(id);
                            _showInfo('Item imported');
                            if (media) {
                                this.proxy('createAttachment', _.bind(function (err) {
                                    if (!err) {
                                        this.reload(id);
                                    } else {
                                        _showInfo('Media not supported');
                                    }
                                }, this), [id, media]);
                            };
                            provider.done(item.taskID, function (err) {
                                
                            });
                            for (var i = 0; points && i < points.length; i++) {
                                var point = points[i];
                                var n = {
                                    text: new Date(point.created).format('m/d/yy h:MMt')
                                }
                                this.proxy('putNote', _.bind(function (id, err) {
                                    
                                }, this), [n, 'n:'+id+' '+this.pointToTag(point)]);
                            };
                        };
                    }, this), [task, tags]);
                    
                }, this))
                return true;
            }, this)
        });
    }, this))
};

Sheet.prototype.editAreaDone = function(val) {//Creates new note
    if (this.editID) {//Edit existing
        this.proxy('editNoteField', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [this.editID, val]);
    } else {//Create new
        this.proxy('createNote', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [val, (this.ignoreAutoTags? '': this.autotags)+(this.newTags? ' '+this.newTags: '')]);
    };
};

var applyColor = function (div, color, gradient) {
    if (!color) {
        return false;
    }
    var step = 32;
    // if (!gradient) {
        div.css('background-color', 'rgb('+color[0]+', '+color[1]+', '+color[2]+')').css('border-color', 'rgb('+(color[0]-3*step)+', '+(color[1]-3*step)+', '+(color[2]-3*step)+')');
    // } else {
    //     div.addClass('has_gradient').css('background-image', '-webkit-gradient(linear, left top, left bottom, color-stop(0%, rgb('+(color[0]+step)+', '+(color[1]+step)+', '+(color[2]+step)+')), color-stop(20%, rgb('+(color[0]-step)+', '+(color[1]-step)+', '+(color[2]-step)+')), color-stop(100%, rgb('+(color[0]+step)+', '+(color[1]+step)+', '+(color[2]+step)+')))').css('border-color', 'rgb('+(color[0]-3*step)+', '+(color[1]-3*step)+', '+(color[2]-3*step)+')')
    // }
    return true;
}

Sheet.prototype.selectNote = function(note) {
    if (this.selected != note) {
        this.root.find('.note_selected').removeClass('note_selected');
        if (this.selected) {
            this.launchTagMethod(this.selected, 'unselect');
        };
        this.launchTagMethod(note, 'select');
    };
    this.selected = note;
    note.div.addClass('note_selected');
    note.div.after(this.menu.element.detach().show());
    note.div.focus();
    note.selectedTag = null;
    this.root.find('.note_tag').removeClass('note_tag_selected');
    this.root.find('.note_line_show').removeClass('note_line_show');
    var note_inline = note.note_inline;
    if (note_inline) {
        note_inline.detach();
    };
    note.div.children('.note_line_hide').add(note.div.children('.note_text').find('.note_line_hide')).addClass('note_line_show');
    if (note_inline) {
        note_inline.appendTo(note.div);
    };
    // log('Select note', note.tags, note);
    this.moveNowLine();
    this.updated();
};

Sheet.prototype.unselectNote = function() {
    this.root.find('.note_line_show').removeClass('note_line_show');
    if (this.selected) {
        this.selected.div.find('.note_tag').removeClass('note_tag_selected');
        this.selected.div.removeClass('note_selected');
        this.selected.selectedTag = null;
    };
    this.selected = null;
    this.menu.element.hide();
    this.updated();
};

Sheet.prototype.selectTag = function(t) {
    // log('Click tag:', t);
    this.selected.selectedTag = t;
    this.selected.div.find('.note_tag').removeClass('note_tag_selected');
    t.div.addClass('note_tag_selected');
    this.launchTagMethod(this.selected, 'click', t.id);
    this.updated();    
};

Sheet.prototype.startNoteWithTag = function(note, tag, place) {
    if (this.launchTagMethod(note, 'start', tag)) {
        return;
    };
    this.newNote(tag, false, place);
};

Sheet.prototype.showTag = function(note, t, parent, remove) {//
    var tag = $(document.createElement('div')).addClass('note_tag draggable').attr('draggable', 'true').appendTo(parent);
    if (t.tag_display) {
        tag.addClass('note_tag_display_'+t.tag_display);
    } else {
        if (this.tagConfig[t.id]) {
            tag.addClass('note_tag_display_'+this.tagConfig[t.id]);
        };
    }
    applyColor(tag, t.color, true);
    t.div = tag;
    tag.text(t.caption);
    this.launchTagMethod(note, 'show', t.id, tag);
    tag.bind('dblclick', {tag: t}, _.bind(function(e) {
        this.startNoteWithTag(note, t.id);
        e.preventDefault();
        return false;
    }, this));
    tag.bind('click', {div: tag, tag: t}, _.bind(function(e) {//
        // log('Click on tag', t);
        if (this.selected != note) {
            return true;
        };
        if (e.shiftKey) {
            this.startTextEdit(this.selected.id, this.selected.div, 'tag', t.id);
            return false;
        };
        //e.data.div.siblings('.note_tag').find('.note_button').hide();
        //e.data.div.find('.note_button').show();
        // if (note.selectedTag == t && CURRENT_PLATFORM_MOBILE) {//Show menu
        //     new PopupMenu({
        //         element: this.root,
        //         items: [{
        //             caption: 'Select notes',
        //             handler: _.bind(function() {
        //                 this.proxy('openTag', null, [t.id]);
        //                 return true;
        //             }, this),
        //         }, {
        //             caption: 'Remove tag',
        //             handler: _.bind(function() {
        //                 this.proxy('removeTag', _.bind(function(id, err) {//
        //                     if (id) {
        //                         this.reload();
        //                     };
        //                 }, this), [note.id, t.id]);
        //                 return true;
        //             }, this),
        //         }, {
        //             caption: 'Create note',
        //             handler: _.bind(function() {
        //                 this.newNote(t.id);
        //                 return true;
        //             }, this),
        //         }]
        //     });
        // };
        this.selectTag(t);
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
                    this.reload(n.id);
                };
            }, this), [n.id, t.id]);
        } else {//Create note with tag
            this.proxy('putNote', _.bind(function(id, err) {
                if (id) {
                    this.proxy('addTag', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(id);
                        };
                    }, this), [id, t.id]);
                };
            }, this), [n]);
        };
    }, this))
    this.enableTagDrop(tag, _.bind(function(tag, text) {
        this.proxy('addTag', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [note.id, t.id, tag]);
    }, this));
};

Sheet.prototype.editNote = function(note, div) {
    if (this.launchTagMethod(note, 'edit_note', null)) {
        _showInfo('External editor is used')
        return;
    };
    this.editID = note.id;
    this.areaPanel.detach().insertAfter(div);
    this.areaPanel.show();
    this.editing = true;
    this.scrollTo(this.areaPanel);
    this.area.val(note.text || '').focus();
    this.updated();
    // setTimeout(_.bind(function () {
    //     this.area.focus();
    // }, this), 10);
};

Sheet.prototype.enableTagDrop = function(div, handler, id) {//Called when tag dropped
    div.bind('dragover', _.bind(function(e) {
        ctrlKey = e.ctrlKey;
        if (dd.hasDDTarget(e, tagDDType)) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, 'text/uri-list')) {
            e.preventDefault();
        };
    }, this)).bind('drop', _.bind(function(e) {//Dropped
        log('Enable tag drop');
        var drop = dd.getDDTarget(e, 'text/uri-list');
        if (drop) {//URL - new note
            var text = dd.getDDTarget(e, 'text/html');
            if (text) {
                text = $(text).text();
            };
            if (!text) {
                text = dd.getDDTarget(e, 'text/plain') || drop;
            };
            handler('l:'+drop, text);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        var drop = dd.getDDTarget(e, tagDDType);
        if (drop) {
            handler(drop);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.enableNoteDrop = function(div, handler, id, special_drop_handler) {//Called when note or text is dropped
    var filesDD = 'application/x-vnd.adobe.air.file-list';
    var ctrlKey = false;
    div.bind('dragenter', _.bind(function (e) {
        div.addClass('drag_active');
    }, this)).bind('dragleave', _.bind(function (e) {
        div.removeClass('drag_active');
    }, this)).bind('dragover', _.bind(function(e) {
        if (dd.hasDDTarget(e, noteDDType)) {
            e.preventDefault();
        };
        if (dd.hasDDTarget(e, filesDD)) {
            e.preventDefault();
        };
    }, this)).bind('drop', _.bind(function(e) {//Dropped
        log('enableNoteDrop::drop', e);
        var drop = dd.getDDTarget(e, noteDDType);
        if (drop) {//Only ID - note drop
            // log('Dropped note', drop);
            handler({id: drop}, e);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
        if (CURRENT_PLATFORM == PLATFORM_AIR) {
            drop = dd.getDDTarget(e, filesDD);
        } else {
            drop = e.originalEvent.dataTransfer.files;
        }
        if (drop) {//URL - new note
            //log('Drop file', e.ctrlKey, e.shiftKey, ctrlKey, e.originalEvent.dataTransfer.dropEffect);
            // if (ctrlKey) {//Copy links
            //     for (var i = 0; i < drop.length; i++) {//Copy and create file
            //         var f = drop[i];
            //         log('Dropped file link', f.nativePath);
            //         handler({text: f.name, link: f.nativePath});
            //     };
            // } else {//Copy files
            //     var files = this.proxy('copyFile', drop);
            //     if (!files) {
            //         log('File copy error');
            //         return false;
            //     };
            //     for (var i = 0; i < files.length; i++) {//
            //         log('Dropped file storage', files[i].text);
            //         handler(files[i]);
            //     };
            // };
            if (drop.length == 1) {
                this.proxy('createAttachment', _.bind(function (err) {
                    if (err) {
                        _showInfo('Upload not supported');
                    } else {
                        this.reload(id);
                    }
                }, this), [id, drop[0]]);
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
            handler({text: _.trim(drop)}, e);
            e.stopPropagation();
            e.preventDefault();
            return false;
        };
    }, this));
};

Sheet.prototype.openNote = function(note, inline) {
    var sort = '';
    for (var i = 0; i < note.tags.length; i++) {
        var tag = note.tags[i];
        if (_.startsWith(tag, 'sort:')) {
            sort = tag.substr('sort:'.length);
        };
    };
    if (inline) {
        if (!note.inline_notes) {
            this.expandedNotes[note.id] = true;
            var div = $(document.createElement('div')).addClass('note_inline_notes').appendTo(note.div);
            $(document.createElement('div')).addClass('clear').appendTo(div);
            note.inline_notes = div;
            this.proxy('loadNotes', _.bind(function(list, err) {//
                // log('Notes loaded:', list, err);
                if (list) {//Display list
                    for (var i = 0; i < list.length; i++) {//
                        // log('Show note', list[i]);
                        this.showNote(list[i], div, false);
                    };
                    this.updated();
                };
            }, this), ['n:!'+note.id, sort || 'd* t*']);
        } else {
            delete this.expandedNotes[note.id];
            note.inline_notes.remove();
            note.inline_notes = null;
        };
        return;
    };
    // log('openNote', note, sort);
    this.proxy('openTag', null, ['n:'+note.id, sort]);
};

Sheet.prototype.showNote = function(note, parent, lastSelected, preventExpand) {//
    var div = $(document.createElement('div')).addClass('note draggable').insertBefore(parent.children('.clear'));
    note.divID = 'note'+(this.noteIndex++);
    div.attr('tabindex', 0).attr('id', note.divID);
    this.notes[note.divID] = note;
    
    var now = new Date();
    var dt = new Date(note.created || now.getTime());
    var afterStr = [dt.format('m/d'+(now.getFullYear() != dt.getFullYear()? '/yy': '')+' h:MMt')];
    this.launchTagMethod(note, 'build_after', null, afterStr);
    div.attr('data-content', afterStr.join('/'));
    
    applyColor(div, note.color, false);
    note.div = div;
    div.bind('dblclick', {note: note, div: div}, _.bind(function(e) {
        this.editNote(note, div);
        e.preventDefault();
        return false;
    }, this));
    div.bind('click', {div: div}, _.bind(function(e) {//
        if (e.ctrlKey) {//Open tag
            this.openNote(note);
            return false;
        };
        // log('Note', note);
        if (this.selected == note && !preventExpand) {
            this.openNote(note, true);
        };
        this.areaPanel.hide();
        this.textPanel.hide();
        this.editing = false;
        this.root.find('.note').removeClass('note_selected');
        this.selectNote(note);
        return false;
    }, this));
    // div.bind('dragover', {note: note}, _.bind(function(e) {
    //     if (dd.hasDDTarget(e, tagDDType)) {
    //         e.preventDefault();
    //     };
    //     //if (dd.hasDDTarget(e, noteDDType)) {
    //         //e.preventDefault();
    //     //};
    // }, this));
    this.enableTagDrop(div, _.bind(function(tag, text) {
        this.proxy('addTag', _.bind(function(id, err) {//
            if (id) {
                this.reload(note.id);
            };
        }, this), [note.id, tag]);
    }, this));
    this.enableNoteDrop(div, _.bind(function(n) {
        if (n.id) {//
            this.proxy('addTag', _.bind(function(id, err) {//
                if (id) {
                    this.reload(note.id);
                };
            }, this), [note.id, 'n:'+n.id]);
        } else {//put note and add tag
            this.proxy('putNote', _.bind(function(id, err) {
                if (id) {
                    this.proxy('addTag', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(note.id);
                        };
                    }, this), [note.id, 'n:'+id]);
                };
            }, this), [n]);
        };
    }, this), note.id);
    div.bind('dragstart', {note: note}, _.bind(function(e) {//
        dd.setDDTarget(e, noteDDType, e.data.note.id);
        e.stopPropagation();
        return true;
    }, this));
    var tags = $(document.createElement('div')).addClass('note_tags');
    if (note.subnotes>1) {
        $(ui.buildIcon('ic_notes')).appendTo(tags).addClass('left_icon').bind('click', {note: note, div: div}, _.bind(function(e) {//Add tag
            this.openNote(note, e.ctrlKey);
            return false;
        }, this));
    }
    $('<div style="clear: both;"/>').appendTo(div);
    var text = $(document.createElement('div')).addClass('note_text').appendTo(div);
    var lines = note.parsed || [''];
    if (!this.launchTagMethod(note, 'show_note', null, text, lines)) {
        for (var j = 0; j < lines.length; j++) {//Add lines
            var line = lines[j];
            var line_div = $(document.createElement('div')).addClass('note_line').appendTo(text);
            this.renderLine(note, line, line_div);
            // if (line.length == 0) {//Add text
            //     line_div.text('-');
            // };
            // if (j == 0) {//Prepend link
            //     tags.appendTo(line_div);
            //     // if (note.link) {
            //     //     $(_buildIcon('link_button')).addClass('left_icon').appendTo(line_div).bind('click', _.bind(function(e) {
            //     //         this.proxy('openLink', _.bind(function(res) {
            //     //         }, this), [note.link, e.ctrlKey]);
            //     //         return false;
            //     //     }, this));
            //     // };
            // };
        };        
    };
    text.children().eq(0).prepend(tags);
    if (note.display) {
        var displays = note.display.split(' ');
        for (var i = 0; i < displays.length; i++) {
            var disp = displays[i];
            if (disp == 'none') {//Hide lines
                text.find('.note_line').addClass('note_line_hide');
                div.addClass('note_bottom_bg');
            };
            if (disp== 'notags') {//Hide tags
                tags.addClass('note_line_hide');
            };
            if (disp == 'title') {//Hide all except first line
                text.find('.note_line').not(text.find('.note_line').first()).addClass('note_line_hide');
                div.addClass('note_bottom_bg');
            };        
            if (disp == 'short') {//Small note
                div.addClass('note_short');
            };        
        };
    };
    note.tag_objects = [];
    for (var j = 0; j < note.tags_captions.length; j++) {//Display tags
        var t = _.clone(note.tags_captions[j]);
        note.tag_objects.push(t);
        this.showTag(note, t, tags, true);

    };
    if (lastSelected) {
        this.selectNote(note);
    };
    $('<div style="clear: both;"/>').appendTo(tags);
    $('<div style="clear: both;"/>').appendTo(div);
    if (this.expandedNotes[note.id]) {
        this.openNote(note, true);
    };
    return div;
};

Sheet.prototype.renderLine = function(note, line, line_div) {
    var markers = [
        {
            text: '#',
            cls: 'ic_sharp'
        }, {
            text: '*',
            cls: 'ic_star'            
        }, {
            text: '-',
            cls: 'ic_minus'
        }, {
            text: '+',
            cls: 'ic_plus'            
        }, {
            text: '!',
            cls: 'ic_exclamation'            
        }, {
            text: '?',
            cls: 'ic_question'            
        }
    ];
    var findMarker = function (text) {
        for (var i = 0; i < markers.length; i++) {
            if (markers[i].text == text) {
                return i;
            };
        };
        return 0;
    }

    var addText = function (text, parent) {
        $(document.createTextNode(text)).appendTo(parent);
    }

    for (var k = 0; k < line.length; k++) {//Add words
        var word = line[k];
        if (word.type == 'text') {//Add word
            $(document.createElement('div')).addClass('note_word').appendTo(line_div).text(word.text);
            addText(' ', line_div);
        } else if (word.type == 'checkbox') {
            var cbox = $(ui.buildIcon(word.checked? 'ic_check_yes': 'ic_check_no')).appendTo(line_div).css('float', 'left');
            cbox.bind('click', {note: note, box: word}, _.bind(function(e) {
                var new_text = e.data.note.text.substr(0, e.data.box.at)+(e.data.box.checked? '[ ]': '[X]')+e.data.note.text.substr(e.data.box.at+3);
                this.proxy('editNoteField', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(id);
                    };
                }, this), [e.data.note.id, new_text]);
                return false;
            }, this));
            addText(' ', line_div);
            // $(document.createElement('div')).addClass('note_word').appendTo(line_div).text(' ');
        } else if (word.type == 'marker') {
            var m = findMarker(word.text);
            var cbox = $(ui.buildIcon(markers[m].cls)).appendTo(line_div).css('float', 'left');
            cbox.bind('click', {note: note, box: word, next: markers[(m+1) % markers.length]}, _.bind(function(e) {
                var new_text = e.data.note.text.substr(0, e.data.box.at)+e.data.next.text+e.data.note.text.substr(e.data.box.at+1);
                this.proxy('editNoteField', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(id);
                    };
                }, this), [e.data.note.id, new_text]);
                return false;
            }, this));
            // $(document.createElement('div')).addClass('note_word').appendTo(line_div).text(' ');
            addText(' ', line_div);
        } else if (word.type == 'tag') {//Add tag
            this.showTag(note, word.tag, line_div);
            // $(document.createElement('div')).addClass('note_word').appendTo(line_div).text(' ');
            addText(' ', line_div);
        } else if (word.type == 'link') {//Add link
            var div = $(document.createElement('div')).addClass('note_word').appendTo(line_div);
            var anchor = $(document.createElement('a')).addClass('note_link').attr('href', word.link).appendTo(div).text(word.text);
            anchor.bind('click', word, _.bind(function (e) {
                this.proxy('openLink', _.bind(function(res) {
                }, this), [e.data.link, e.ctrlKey]);
                return false;
            }, this));
            addText(' ', line_div);
        };
    };
    $('<div style="clear: both;"/>').appendTo(line_div);
    
};

Sheet.prototype.reload_default = function(list, beforeID) {//
    this.root.children('.note').remove();
    for (var i = 0; i < list.length; i++) {//
        this.showNote(list[i], this.root, list[i].id == beforeID);
    };
    this.updated();
};

Sheet.prototype.render_hour = function(hour, div) {
    this.enableTagDrop(div, _.bind(function(tag, text) {
        this.proxy('createNote', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [text || null, this.autotags+' '+tag+' t:'+(hour*100)]);
    }, this));    
};

Sheet.prototype.resizeGrid = function() {
    for (var i = 0; i < this.gridItems.length; i++) {
        var col = this.gridItems[i];
        col.div.detach();
    };
    // Remove all rows
    this.gridBody.empty();
    if (this.gridItems.length == 0) {
        return; //Nothing to show
    };
    var minColWidth = ui.em()*17;
    var cols = this.gridConfig.cols || this.gridItems.length;
    if (this.gridBody.width()/cols<minColWidth) { // Width not enough
        cols = Math.floor(this.gridBody.width()/minColWidth);
        if (cols<1) { // Fix
            cols = 1;
        };
    };
    var width = ''+Math.floor(100/cols)+'%';
    var row = $(document.createElement('div')).addClass('grid_row').appendTo(this.gridBody);
    var colsInRow = 0;
    for (var i = 0; i < this.gridItems.length; i++) {
        var col = this.gridItems[i];
        col.div.appendTo(row).width(width);
        colsInRow++;
        if (colsInRow == cols) {
            row = $(document.createElement('div')).addClass('grid_row').appendTo(this.gridBody);
            colsInRow = 0;
        };
    };
    this.updated();
};

Sheet.prototype.createGridColumn = function(index, config) {
    var div = $(document.createElement('div')).addClass('grid_column');
    var menuDiv = $(document.createElement('div')).addClass('grid_column_menu').appendTo(div);
    var menu = new Buttons({
        root: menuDiv,
        rows: [0, '5em'],
        maxElements: 2
    });
    var headerPlace = menu.getRow(0);
    var header = $(document.createElement('div')).addClass('grid_header');
    headerPlace.prepend(header);
    header.text(config.caption || 'Untitled');
    var acceptNote = _.bind(function (id) {
        var tags = this.autotags;
        for (var i = 0; i < this.gridItems.length; i++) {
            var col = this.gridItems[i];
            if (col._tag && i != index) {
                tags += ' -'+col._tag;
            };
            if (config._tag) {
                tags += ' '+config._tag;
            };
        };
        this.proxy('moveNote', _.bind(function(id, err) {//
            if (id) {
                this.reload(id);
            };
        }, this), [id, tags]);
    }, this);
    menu.addButton({
        caption: '+',
        width: 1,
        row: 1,
        classNameInner: 'button_create',
        handler: _.bind(function() {//
            this.startNoteWithTag({tags_captions: []}, config.tag, notesDiv);
            return true;
        }, this)
    });
    menu.addButton({
        caption: '|',
        width: 1,
        row: 1,
        handler: _.bind(function() {//
            var items = [];
            new PopupMenu({
                element: this.menuPlace || this.root,
                items: items
            });
            return true;
        }, this)
    });
    var notesDiv = $(document.createElement('div')).addClass('grid_notes').appendTo(div);
    $(document.createElement('div')).addClass('clear').appendTo(notesDiv);
    config.div = div;
    config.notesDiv = notesDiv;
    config._tag = this.proxy('adoptTag', null, [config.tag]);
    if (config._tag) {
        this.tagConfig[config._tag] = 'selected';
    };
    this.enableTagDrop(div, _.bind(function(tag, text) {
        this.startNoteWithTag({tags_captions: []}, tag+' '+config.tag, notesDiv);
    }, this));
    this.enableNoteDrop(div, _.bind(function(n) {
        if (n.id) {//Note
            acceptNote(n.id);
        } else {
            this.proxy('putNote', _.bind(function(id, err) {//
                if (id) {
                    this.reload(n.id);
                };
            }, this), [n, this.autotags+' '+config.tag]);
        };
    }, this));
    // log('Col', config);

};

Sheet.prototype.reload_grid = function(list, beforeID) {
    this.root.find('.note').remove();
    // log('Reload grid', list.length, this.gridItems.length);
    for (var i = 0; i < list.length; i++) {//
        var colNum = 0; // Put to first col by default
        for (var k = 0; k < this.gridItems.length; k++) {
            var col = this.gridItems[k];
            if (col._tag) {
                for (var j = 0; j < list[i].tags.length; j++) {
                    var tag = list[i].tags[j];
                    if (tag == col._tag) {
                        colNum = k;
                    };
                };
            };
        };
        if (this.gridItems[colNum]) {
            this.showNote(list[i], this.gridItems[colNum].notesDiv, list[i].id == beforeID);
        };
    };
    this.updated();
};

Sheet.prototype.prepare_grid = function() {
    // log('Prepare grid', this.displayConfig);
    if (this.panel) {
        this.panel.wide = true;
        this.canToggleWide = false;
        this.panel.onResize = _.bind(function () {
            setTimeout(_.bind(function () {
                this.resizeGrid();
            }, this), 0);
        }, this);
    };
    this.gridConfig = {cols: 1, items: []};
    if (this.displayConfig) {
        try {
            this.gridConfig = JSON.parse(this.displayConfig);
        } catch (e) {
            log('Error parsing', e);
            _showInfo('Error loading display config');
        }
    };
    this.gridItems = this.gridConfig.items || [];
    this.gridBody = $(document.createElement('div')).addClass('grid_body').insertBefore(this.root.children('.clear'));
    for (var i = 0; i < this.gridItems.length; i++) {
        var col = this.gridItems[i];
        this.createGridColumn(i, col);
    };
};

Sheet.prototype.prepare_cards = function() {
    this.hiddenLines = {};
    this.cardConfig = {};
    if (this.displayConfig) {
        try {
            this.cardConfig = JSON.parse(this.displayConfig);
        } catch (e) {
            log('Error parsing', e);
            _showInfo('Error loading display config');
        }
    };
    this.showList = false;
    this.navigationDiv = $(document.createElement('div')).insertAfter(this.root.children('.clear'));
    this.navigation = new Buttons({
        root: this.navigationDiv,
        rows: [0, '2.5em'],
        maxElements: 3,
        safe: true
    });
    this.navigation.addButton({
        caption: 'Previous',
        handler: _.bind(function () {
            if (this.currentCard>0) {
                this.currentCard--;
                this.showCard();
            };
        }, this)
    });
    this.navigation.addButton({
        caption: 'Show list',
        handler: _.bind(function () {
            this.showList = !this.showList;
            this.reload();
        }, this)
    });

    // var showButton = navigation.addButton({
    //     caption: 'Show all',
    //     classNameInner: 'button_create'
    // });
    this.navigation.addButton({
        caption: 'Next',
        handler: _.bind(function () {
            if (this.currentCard<this.cards.length-1) {
                this.currentCard++;
                this.showCard();
            };
        }, this)
    });
    this.navigation.addButton({
        caption: '|',
        width: 3,
        row: 1,
        handler: _.bind(function() {//
            var note = this.cards[this.currentCard];
            if (!note) {
                _showInfo('No card selected');
                return true;
            };
            var items = [];
            var linesCount = note.parsed.length;
            for (var i = 0; i < linesCount; i++) {
                items.push({
                    caption: ''+(this.hiddenLines[i]? 'Show': 'Hide')+' line '+i,
                    line: i,
                    handler: _.bind(function (item) {
                        this.hiddenLines[item.line] = !(this.hiddenLines[item.line] || false);
                        this.showCard();
                        return true;
                    }, this)
                });
            };
            items.push({
                caption: 'First item',
                handler: _.bind(function () {
                    this.currentCard = 0;
                    this.showCard();
                    return true;
                }, this)
            });
            items.push({
                caption: 'Last item',
                handler: _.bind(function () {
                    this.currentCard = this.cards.length-1;
                    this.showCard();
                    return true;
                }, this)
            });
            items.push({
                caption: 'Randomize',
                handler: _.bind(function () {
                    var arr = [];
                    while (this.cards.length>0) {
                        var index = Math.floor(Math.random()*this.cards.length);
                        arr.push(this.cards[index]);
                        this.cards.splice(index, 1);
                    }
                    this.cards = arr;
                    this.currentCard = 0;
                    this.showCard();
                    return true;
                }, this)
            });
            new PopupMenu({
                element: this.menuPlace || this.root,
                items: items
            });
            return true;
        }, this)
    });
    this.currentCard = 0;
};
Sheet.prototype.keypress_cards = function (e) {
    switch(e.keyCode) {
        case 65: // a
            this.navigation.click(this.navigation.buttons[0]);
            return false;
        case 83: // s
            this.navigation.click(this.navigation.buttons[2]);
            return false;
        case 67: // c
            this.navigation.click(this.navigation.buttons[3]);
            return false;
        case 76: // l
            this.navigation.click(this.navigation.buttons[1]);
            return false;
    }
};


Sheet.prototype.showCard = function() {
    this.root.find('.note').remove();
    // log('Show card', this.currentCard, this.cards);
    var note = this.cards[this.currentCard];
    this.navigation.setDisabled(this.navigation.buttons[0], this.currentCard == 0);
    this.navigation.setDisabled(this.navigation.buttons[2], this.currentCard>=this.cards.length-1);
    if (!note) {
        return;
    };
    this.unselectNote(this.selected);
    this.showNote(note, this.root, false, true);
};

Sheet.prototype.do_reload_cards = function(tags, sort) {
    if (this.showList) {
        // Default
        return false;
    };
    tags = this.data.tags || '';
    if (this.cardConfig.tags) {
        tags += ' '+this.cardConfig.tags;
    } else {
        // Default
        return false;
    }
    this.proxy('loadNotes', _.bind(function(list, err) {//
        if (list) {//Display list
            this.reload_cards(list);
        };
    }, this), [tags, sort, this.extra]);
    return true;
};

Sheet.prototype.reload_cards = function(list, beforeID) {
    this.root.find('.note').remove();
    this.cards = list;
    if (this.currentCard>=this.cards.length) {
        this.currentCard = 0;
    };
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == beforeID) {
            this.currentCard = i;
            break;
        };
    };
    if (this.showList) {
        this.navigation.setDisabled(this.navigation.buttons[0], true);
        this.navigation.setDisabled(this.navigation.buttons[2], true);        
        for (var i = 0; i < list.length; i++) {//
            this.showNote(list[i], this.root, list[i].id == beforeID);
        };
    } else {
        this.showCard();
    }
    this.updated();
};

Sheet.prototype.prepare_timeline = function() {
    this.loadNotes = 20;
    this.page = 0;
    this.extra.limit = ''+this.loadNotes+' offset '+this.page;
    this.extra.order = ['!id'];
    var pagingDiv = $(document.createElement('div')).insertBefore(this.root.children('.clear'));
    this.pagingMenu = new Buttons({
        root: pagingDiv,
        maxElements: 2,
        safe: true,
        buttons: [
            {
                caption: 'Load more',
                handler: _.bind(function () {
                    this.page += this.loadNotes;
                    this.extra.limit = ''+this.loadNotes+' offset '+this.page;
                    this.reload(null, true);
                }, this)
            }, {
                caption: 'Load less',
                handler: _.bind(function () {
                    this.page -= this.loadNotes;
                    if (this.page<0) {
                        this.page = 0;
                    };
                    this.extra.limit = ''+this.loadNotes+' offset '+this.page;
                    this.reload(null, true);
                }, this)
            }
        ]
    })
};


Sheet.prototype._prepare_days = function(dstart, dend) {
    this.days = {};
    this.daystart = dstart;
    this.noDays = $(document.createElement('div')).addClass('no_days').appendTo(this.root);
    $(document.createElement('div')).addClass('clear').appendTo(this.noDays);
    var lastDate = dend.format('yyyymmdd');
    var dt = dstart;
    var now = new Date();
    do {
        var done = lastDate == dt.format('yyyymmdd');
        var tag = 'd:'+dt.format('yyyymmdd');
        var div = $(document.createElement('div')).addClass('days_day').appendTo(this.root);
        $(document.createElement('div')).addClass('days_caption').appendTo(div).text(dt.format('m/d/yy'));
        $(document.createElement('div')).addClass('clear').appendTo(div);
        this.days[tag] = {
            div: div,
            dt: dt.format('yyyymmdd')
        };
        div.bind('click', _.bind(function(e) {//
            if (this.editing) {//
                return true;
            };
            this.unselectNote();
        }, this));
        div.bind('dblclick', {tag: tag}, _.bind(function(e) {
            this.newNote(e.data.tag, true);
            e.preventDefault();
            return false;
        }, this));
        this.enableNoteDrop(div, _.bind(function(n) {
            if (n.id) {//Note
                this.instance.proxy('moveNote', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(n.id);
                    };
                }, this.instance), [n.id, '-d:* '+this.tag]);
            } else {
                this.instance.proxy('putNote', _.bind(function(id, err) {//
                    if (id) {
                        this.reload(n.id);
                    };
                }, this.instance), [n, this.tag]);
            };
        }, {instance: this, tag: tag}));
        dt.setDate(dt.getDate()+1);
    } while (!done);
};

Sheet.prototype.prepare_week = function() {
    //Create divs
    var dinfo = this.proxy('tagInfo', null, [this.data.tags]);
    if (dinfo) {
        this._prepare_days(dinfo.dstart, dinfo.dend);
    };
};

Sheet.prototype.prepare_month = function() {
    //Create divs
    var dinfo = this.proxy('tagInfo', null, [this.data.tags]);
    if (dinfo) {
        this._prepare_days(dinfo.dstart, dinfo.dend);
    };
};

Sheet.prototype.reload_timeline = function(list, beforeID) {
    this.root.find('.note').remove();
    this.root.find('.timeline_header').remove();
    var ago = function (method, shift) {
        var dt = new Date();
        dt['set'+method].call(dt, dt['get'+method].call(dt)-shift);
        return dt.getTime();
    };
    var headers = [
        {dt: 0}, 
        {caption: 'year ago', dt: ago('FullYear', 1)},
        {caption: '3 months ago', dt: ago('Month', 3)},
        {caption: 'month ago', dt: ago('Month', 1)},
        {caption: 'week ago', dt: ago('Date', 7)},
        {caption: '3 days ago', dt: ago('Date', 3)},
        {caption: '2 days ago', dt: ago('Date', 2)},
        {caption: 'day ago', dt: ago('Date', 1)},
        {caption: '12 hours ago', dt: ago('Hours', 12)},
        {caption: '6 hours ago', dt: ago('Hours', 6)},
        {caption: '3 hours ago', dt: ago('Hours', 3)},
        {caption: 'hour ago', dt: ago('Hours', 1)},
        {caption: '30 minutes ago', dt: ago('Minutes', 30)},
        {caption: '5 minutes ago', dt: ago('Minutes', 5)},
        {caption: 'minute ago', dt: ago('Minutes', 1)}
    ];
    var prevCreated = 0;
    var startHeader = 1;
    for (var i = 0; i < list.length; i++) {//
        if (i>0) {
            var headerFound = 0;
            for (var j = startHeader; j < headers.length; j++) {
                if (prevCreated<headers[j].dt && list[i].created>=headers[j].dt) {
                    headerFound = j;
                };
            };
            if (headerFound>0) {
                startHeader = headerFound;
                var div = $(document.createElement('div')).addClass('timeline_header').text(headers[headerFound].caption);
                div.insertBefore(this.root.children('.clear'));
                div.bind('click', _.bind(function (e) {
                    $(e.target).nextAll('.note').addClass('note_selected').find('.note_line_hide').addClass('note_line_show');
                }, this));
            };
        };
        prevCreated = list[i].created;
        this.showNote(list[i], this.root, list[i].id == beforeID);
    };
    this.pagingMenu.setDisabled(this.pagingMenu.buttons[0], list.length != this.loadNotes);
    this.pagingMenu.setDisabled(this.pagingMenu.buttons[1], this.page == 0);
    this.updated();
};

Sheet.prototype._reload_days = function(list, beforeID) {
    this.root.find('.note').remove();
    for (var i = 0; i < list.length; i++) {//
        var dtTag = null;
        for (var j = 0; j < list[i].tags.length; j++) {
            var tag = list[i].tags[j];
            if (_.startsWith(tag, 'd:')) {
                dtTag = tag;
            };
        };
        var div = this.showNote(list[i], this.days[dtTag]? this.days[dtTag].div: this.noDays, list[i].id == beforeID);
    };
    this.updated();
};

Sheet.prototype.reload_week = function(list, beforeID) {//
    this._reload_days(list, beforeID);
};

Sheet.prototype.reload_month = function(list, beforeID) {//
    this._reload_days(list, beforeID);
};

Sheet.prototype.reload_day = function(list, beforeID) {//
    this.startHour = 0;
    this.endHour = 23;
    if (!this.hours) {//Create hours
        this.hours = [];
        this.noHour = $(document.createElement('div')).appendTo(this.root);
        $(document.createElement('div')).addClass('clear').appendTo(this.noHour);
        for (var i = this.startHour; i <= this.endHour; i++) {//Create divs
            var hr = $(document.createElement('div')).addClass('day_hour').appendTo(this.root);
            $(document.createElement('div')).addClass('day_hour_caption').appendTo(hr).text(''+(i>12? i-12: i)+(i>11? 'p': 'a'));
            this.hours[i] = hr;
            var notes_place = $(document.createElement('div')).addClass('day_hour_notes').appendTo(hr);
            $(document.createElement('div')).addClass('clear').appendTo(notes_place);
            if (CURRENT_PLATFORM_MOBILE) {
                installSwipeHandler(hr, _.bind(function(hour) {//
                    this.newNote('t:'+(hour*100));
                    return false;
                }, this), i);
            };
            this.render_hour(i, hr);
            hr.bind('dragover', _.bind(function(e) {
                if (dd.hasDDTarget(e, timeDDType)) {
                    e.preventDefault();
                };
            }, this)).bind('drop', {hour: i},  _.bind(function(e) {//Dropped
                var drop = dd.getDDTarget(e, timeDDType);
                if (drop && this.selected) {//Only ID - note drop
                    // log('Dropped time', drop);
                    this.proxy('moveNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(id);
                        };
                    }, this), [this.selected.id, '-t:* t:'+(drop*100)+'-'+(e.data.hour*100)]);
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                };
            }, this));
            this.enableNoteDrop(hr, _.bind(function(n) {
                if (n.id) {//Note
                    this.instance.proxy('moveNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(n.id);
                        };
                    }, this.instance), [n.id, this.instance.data.autotags+' -t:* t:'+(this.hour*100)]);
                } else {
                    this.instance.proxy('putNote', _.bind(function(id, err) {//
                        if (id) {
                            this.reload(n.id);
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
                this.unselectNote();
            }, this));
        };
        this.nowLine = $(document.createElement('div')).appendTo(this.root).addClass('now_line');
        if (this.moveNowLineID) {
            cancelInterval(this.moveNowLineID);
        };
        if (!CURRENT_PLATFORM_MOBILE) {
            this.moveNowLineID = setInterval(_.bind(this.moveNowLine, this), 3*60*1000);
        };
    } else {
        for (var i = this.hours.length-1; i >=0 ; i--) {
            var hr = this.hours[i];
            hr.detach().insertAfter(this.noHour);
        };
        this.root.find('.note').remove();
    };
    var hrPlaces = [];
    for (var i = this.startHour; i <= this.endHour; i++) {
        hrPlaces.push(null);
    };
    for (var i = 0; i < list.length; i++) {//
        var target = this.hours[list[i].hour];
        // target? target.children('.day_hour_notes'): 
        var div = this.showNote(list[i], this.noHour, list[i].id == beforeID);
        if (target) {
            var timeDown = $(ui.buildIcon('ic_time_down')).addClass('note_time_down');
            div.find('.note_tags').prepend(timeDown);
            timeDown.addClass('draggable').attr('draggable', 'true').bind('dragstart', {hour: list[i].hour}, _.bind(function(e) {//
                dd.setDDTarget(e, timeDDType, e.data.hour);
                e.stopPropagation();
                return true;
            }, this));
        };
        if (!list[i].hours) {
            if (target) {
                div.detach().insertBefore(target.children('.day_hour_notes').children('.clear'));
            };
        } else {
            var hstart = list[i].hours[0];
            var hend = list[i].hours[1];
            var hrsPlace = $(document.createElement('div')).addClass('note_inline_hours').appendTo(div);
            if (!hrPlaces[hstart]) {
                //Not detached
                div.detach().insertBefore(this.hours[hstart]);
            } else {
                div.detach().insertAfter(hrPlaces[hstart]);
            }
            for (var j = hstart; j <= hend; j++) {
                this.hours[j].detach().appendTo(hrsPlace);
                hrPlaces[j] = div;
            };
        }
    };
    this.moveNowLine();
    this.updated();
};

Sheet.prototype.moveNowLine = function() {//Moves now line
    if (!this.hours) {
        return;
    };
    var dt = new Date();
    var div = this.hours[dt.getHours()];
    if (div) {
        div.prepend(this.nowLine);
        var h = Math.floor(div.height()*dt.getMinutes()/60);
        this.nowLine.css('top', h).show();
    } else {
        this.nowLine.hide();
    };
};

Sheet.prototype.reload = function(beforeID, forceNoSelect) {//Asks for items
    this.areaPanel.hide();
    this.textPanel.hide();
    this.menu.element.hide();
    this.editing = false;
    this.selected = null;
    var tags = this.data.tags || '';
    var sort = this.data.sort || '';
    this.noteIndex = 0;
    this.notes = {};
    if (this.data.id) {
        tags = 's:'+this.data.id+'|'+tags;
        if (!sort) {
            sort = 's:'+this.data.id;
        };
    };
    var mode = this.display;
    if (this['do_reload_'+mode] && this['do_reload_'+mode].call(this, tags, sort)) {//Have do reload
        return;
    };
    this.proxy('loadNotes', _.bind(function(list, err) {//
        if (list) {//Display list
            if (!beforeID && list.length>0 && !forceNoSelect && mode == 'default') {
                beforeID = list[0].id;
            };
            if (this['reload_'+mode]) {//Have reload
                this['reload_'+mode].call(this, list, beforeID);
            };
        };
    }, this), [tags, sort, this.extra]);
};

Sheet.prototype.scrollTo = function(element) {
    if (CURRENT_PLATFORM_MOBILE) {
        var offs = element.offset();
        $(window).scrollTop(offs.top-10);
    };
};

Sheet.prototype.startTextEdit = function(id, note, field, value, handler) {//Shows editor
    this.editing = true;
    this.textPanel.detach().insertAfter(note);
    this.textEditHandler = handler || null;
    this.textPanel.show();
    this.scrollTo(this.textPanel);
    this.text.val(value || '').focus();
    this.editID = id;
    this.editField = field;
    this.editValue = value;
    this.updated();
    // setTimeout(_.bind(function () {
    //     this.text.focus();
    // }, this), 10);
};

Sheet.prototype.newNote = function(tags, ignoreAutoTags, place) {//Starts new note
    this.editing = true;
    this.newTags = tags || '';
    this.ignoreAutoTags = ignoreAutoTags;
    (place || this.root).prepend(this.areaPanel.detach());
    this.areaPanel.show();
    this.scrollTo(this.areaPanel);
    this.area.val('').focus();
    this.editID = null;
    this.updated();
    // setTimeout(_.bind(function () {
    //     this.area.focus();
    // }, this), 10);
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
