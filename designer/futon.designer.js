(function($) {

    // helper to validate that a string is a valid JSON string
    var isValidJSON = function (text) {
        var test=true;
        try { var tmp = JSON.parse(text);} catch (err) {test = false;}
        return test;
    }

    // ease the manipulations of the bespin editor
    // try to abstract API bc bespin API still is alpha
  	var bespinHandler = function (element, statusBarElement, initialContent, options) {
        var settings = {
            "idle": function (statusbar) {
                statusbar.html("ready");
            },
            "modified": function (statusbar) {
                statusbar.html("The code has been modified. <span class=\"saveCode\">save code</span>");
            },
            "saving": function (statusbar) {
                statusbar.html("Recording changes");
            },
            "recordSuccess": function(statusbar) {
                statusbar.html("Code has been updated successfully");
            },
            "recordFailure": function (statusbar) {
                statusbar.html("<span class=\"error\">Unable to save code</span>");
            },
            "idleEmpty": function (statusbar) {statusbar.html("Empty ! <span class=\"addTemplate\">insert template</span>");}
        }

        $.extend(settings,options);
        var self=this;
		var intervalId = null;
		var embed = tiki.require("embedded");
		var bespin = embed.useBespin(element.get(0),{
			stealFocus: true,
			syntax: "js",
			initialContent: initialContent,
			settings: {
				"fontsize": 11
			}
		});
        var currentStatus = "";
        var changeStatus = function(event) {
            settings[event].call(self,statusBarElement);
            currentStatus = event;
        }

		changeStatus("idle");

		var checkForAChange = this.checkForAChange = function() {
            if ( bespin.value == initialContent ) {
                if ( initialContent.length == 0 && currentStatus != "idleEmpty" ) {
                    changeStatus("idleEmpty");
                }
                if ( initialContent.length > 0 && currentStatus != "idle" ) {
                    changeStatus("idle");
                }
                if ( currentStatus == "modified" ) {
                    changeStatus("idle");
                }
            } else {
    			if (  currentStatus == "idle" || currentStatus == "idleEmpty" ) {
                    changeStatus("modified");
                }
            }
		};

		intervalId = setInterval(checkForAChange,1000);

		this.getValue = function() {
			return bespin.value;
		};

		this.setValue = function(value) {
            bespin.value = ""; //due to a bug we reinit value before to set the new one
			bespin.value = value;
			return this;
		};

		this.setStatusSaving = function () {
            changeStatus("saving");
		};

		this.setStatusSaveResultOk = function () {
            changeStatus("recordSuccess");
            setTimeout(function() {changeStatus("idle");}, 5000);
		};

		this.setStatusSaveResultKo = function () {
            changeStatus("recordFailure");
			clearInterval(intervalId);
			intervalId = null;
		};


		this.getInitialContent = function (  ) {
			return initialContent ;
		}

		this.setInitialContent = function ( content ) {
			initialContent = content;
			return this;
		}

		this.isDirty = function () {
			if ( bespin.value == initialContent )
				return false;
			return true;
		}
	};


	$.futon = $.futon || {};
	$.extend($.futon, 
{

	CouchDesignerHomePage: function() {
		var urlParts = location.search.substr(1).split("/");
		var dbName = decodeURIComponent(urlParts.shift());
		var entitylist = {
			"view": "View",
			"list": "List",
			"show": "Show"
		};
		var docId = null;
		var entity = null;
		var entityname = null;
		var segments = [];
		// next argument is the design doc
		if (urlParts.length) {
			var tmp = decodeURIComponent(urlParts.shift());
			if ( tmp != '_design' || ! urlParts.length ) {
// 				return false;
				urlParts = [];
			}
			docId = '_design/'+decodeURIComponent(urlParts.shift());
		}
		//next argument is the entity
		if (urlParts.length) {
			entity = urlParts.shift();
			if  ( ! entity in entitylist ) {
				entity = null;
			}
		}

		//next argument is the entityname
		if (urlParts.length) {
			entityname = decodeURIComponent(urlParts.shift());
		}

		//and following arguments are stored in segments
		segments = urlParts;

		var db = this.db = $.couch.db(dbName);
		this.docId = docId;
		this.dbName = dbName;
		this.entitylist = entitylist;
		this.entity = entity;
		this.entityname = entityname;
		this.segments = segments;
		var page = this;
		var currentDdoc = null;
		var bh = null; /* bespin handler */

        function escape(string) {
			return string	.replace(/&/g, "&amp;")
							.replace(/</g, "&lt;")
							.replace(/>/g, "&gt;");
		}

        var templates = {
            "map": {
                "default": "function (doc) {\n\temit(doc._id,null);\n}"
            },
            "reduce": {
                "default": "function (keys,values,rereduce) {\n\treturn sum(values);\n}"
            },
            "list": {
                "default": "function (head, ctx) {\n\tvar row=null;\n\twhile (row = getRow() ) {\n\t\tif ( row.key ) send(\"<li>\"+row.key+\"</li>\");\n\t}\n}"
            },
            "show": {
                "default": "function (doc,ctx) {}"
            }
        };

        function codeTemplateListener (type) {
            var count = 0, index = null;
            if ( templates[type] ) {
                for ( index in templates[type] ) {
                    count++;
                }
                if ( count == 1 ) {
                    for ( index in templates[type] ) {
                        bh.setValue(templates[type][index]).checkForAChange();
                    }
                }
            }
        }

        //
        // sends a list request to the couch server
        //
		var list = function(name, view_name, options , ajaxOptions) {
			name = name.split('/');
			options = options || {};
			if ( !options.evalJS ) options.evalJS = false;
			if ( !options.dataType ) options.dataType = "";
			if ( !options.successStatus ) options.successStatus = 200;
			var type = "GET";
			var data= null;

			// Convert a options object to an url query string.
			// ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
			function encodeOptions(options) {
				var buf = [];
				if (typeof(options) === "object" && options !== null) {
					for (var name in options) {
						if ($.inArray(name, ["error", "success", "evalJS", "dataType", "successStatus"]) >= 0)
                            continue;
						var value = options[name];
						if ($.inArray(name, ["key", "startkey", "endkey"]) >= 0) {
							value = value !== null ? JSON.stringify(value) : null;
						}
						buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
					}
				}
				return buf.length ? "?" + buf.join("&") : "";
			}


			if (options["keys"]) {
				type = "POST";
				var keys = options["keys"];
				delete options["keys"];
				data = JSON.stringify({ "keys": keys });
			}
			$.ajax({
				type: type,
				data: data,
				timeout: 1200000,
				url: db.uri + "_design/" + name[0] +
					"/_list/" + name[1] + '/' + view_name + encodeOptions(options),
				dataType: options.evalJS ? options.dataType : "text",
				error: function (xhr, textstatus) { xhr.errorThrown = textstatus ;},
				complete: function (req) { onCompleteCallback(req,options); }
			});
		};

        //
        // sends a show request to the couch server
        //
		var show = function(name, options ) {
			name = name.split('/');
			options = options || {};
			if ( !options.evalJS ) options.evalJS = false;
			if ( !options.dataType ) options.dataType = "";
			if ( !options.successStatus ) options.successStatus = 200;
			if ( !options.docId ) options.docId= "";
			var type = "GET";
			var data= null;

			function encodeOptions(options) {
				var buf = [];
				if (typeof(options) === "object" && options !== null) {
					for (var name in options) {
						if ($.inArray(name, ["error", "success", "evalJS", "dataType", "successStatus", "docId"]) >= 0)
						continue;
						buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(options[name]));
					}
				}
				return buf.length ? "?" + buf.join("&") : "";
			}
			var docId  =options.docId ? '/' + options.docId : '';
			$.ajax({
				type: type,
				data: data,
				url: db.uri + "_design/" + name[0] +
					"/_show/" + name[1] + docId + encodeOptions(options),
				dataType: options.evalJS ? options.dataType : "text",
				complete: function (req) { onCompleteCallback(req,options); }
				}
			);
		};

        //
        // common function to parse show and list results. We try as much as possible to parse
        // according to the content type header.
        // If it's an error we try to force json conversion since couchdfb don't send JSON headers on error contents
        //
        function onCompleteCallback (req, options) {
            var ct = req.getResponseHeader("content-type") || "", data = "";
            if ( typeof req.errorThrown == "undefined" && ( req.status == options.successStatus || req.status == 304 ) ) {
                data = req.responseText;
                if ( options.dataType === "json" || !options.dataType.length && ct.indexOf("json") >= 0 ) {
                    data = jQuery.parseJSON( data );
				}
                if (options.success) options.success(data,ct);
            } else {
                data = req.responseText;
                try {
                    var json = jQuery.parseJSON( data );
                    data=json;
                } catch ( e ) {}

                if ( options.error ) {
                    if ( typeof data == 'object' ) {
                        options.error(req.status, data.error, data.reason);
                    } else {
                        options.error(req.status, data, "");
                    }
                } else {

                    if ( typeof data == 'object' ) {
                        alert(errorMessage + ": " + data.reason);
                    } else {
                        alert(errorMessage + ": " + data);
                    }
                }
            }
        }

        // send a view request to the server
		function queryViewToServer (button, panel, opts ) {
// 			$.ajaxSetup({"timeout":30000});
			opts.options.success = function (data) {
				if ( typeof data == "object" ) {
					//json display
					var render = $("<pre></pre>");
					render.html($.futon.formatJSON(data, {"html": true}));
					$(".querying",panel).hide();
                    $(".results",panel).html('<p>Response</p>').append(render).show();
					button.removeAttr("disabled");
				}
			};
			opts.options.error = function(a,b,c) {
				if ( b != "timeout" ) {
					$(".error",panel).empty().html("an error occured : "+a+" - "+b+" - "+c);
					$(".querying",panel).hide();
					$(".error",panel).show();
					button.removeAttr("disabled");
				}
			};
			db.view(opts.name,opts.options);
		};

        // prepare show query and call the show function
		function queryShowToServer (button, panel, opts ) {

			opts.options.success = function (data, ct) {
                var render = $("<pre></pre>");
				if ( typeof data == "object" ) {
					render.html($.futon.formatJSON(data, {"html": true}));
					$(".results",panel).empty().append(render);
					if ( ct ) {
						$(".results",panel).prepend('<p>Response (Content-Type: '+ct+')</p>');
					} else {
						$(".results",panel).prepend('<p>Response</p>');
					}
					$(".querying",panel).hide();
					$(".results",panel).show();
					button.removeAttr("disabled");
				} else {
					render.html(escape(data));
					$(".results",panel).empty().append(render);
					if ( ct ) {
						$(".results",panel).prepend('<p>Response (Content-Type: '+ct+')</p>');
					} else {
						$(".results",panel).prepend('<p>Response</p>');
					}
					$(".querying",panel).hide();
					$(".results",panel).show();
					button.removeAttr("disabled");

				}
			};
			opts.options.error = function(a,b,c) {
				if ( b != "timeout" ) {
					$(".error",panel).empty().html("an error occured : "+a+" - "+b+" - <pre class=\"left\"><code>"+c+"</code></pre>");
					$(".querying",panel).hide();
					$(".error",panel).show();
					button.removeAttr("disabled");
				} else {
					$(".error",panel).empty().html("CouchServer take more than 30 seconds to answer.");
					$(".querying",panel).hide();
					$(".error",panel).show();
				}
			};
			opts.options.docId = opts.docId;
			show(opts.name, opts.options, { "dataType": "" });
		};

        // prepare list query and call the list function
		function queryListToServer (button, panel, opts ) {
// 			$.ajaxSetup({"timeout":30000});
			opts.options.success = function (data) {
                var render = $("<pre></pre>");
				if ( typeof data == "object" ) {
					//json display
					render.html($.futon.formatJSON(data, {"html": true}));
                    $(".querying",panel).hide();
                    $(".results",panel).html('<p>Response</p>').append(render).show();
					button.removeAttr("disabled");
				} else {
					render.html(escape(data));
					$(".querying",panel).hide();
                    $(".results",panel).html('<p>Response</p>').append(render).show();
					button.removeAttr("disabled");
				}
			};
			opts.options.error = function(a,b,c) {
				if ( b != "timeout" ) {
                    $(".querying",panel).hide();
					$(".error",panel).html("an error occured : "+a+" - "+b+" - "+c).show();
					button.removeAttr("disabled");
				} else {
                    $(".querying",panel).hide();
					$(".error",panel).html("CouchServer take more than 30 seconds to answer.").show();
				}
			};

			list(opts.name,opts.view_name,opts.options, { "dataType": "" });
		};





        // dispatcher between homepage, view, list, show
		this.bootstrap = function () {
			if ( !docId || !entity || !entityname ) {
				return this.homeBootstrap();
			}

			db.openDoc(docId, {
				"success": function(doc) {
					page.setCurrentDdoc(doc);
					if ( entity+'s' in doc  && entityname in doc[entity+'s'] ) {
						$("#wait").hide();
						$("#designer").show();
						window.onbeforeunload = function() {
							if (bh.isDirty()) {
								return "You've made changes to this document that have not been " +
									"saved yet.";
							}
						}
						return page[entity+'Bootstrap']();
					}
					return page.homeBootstrap();
				},
				"error": function(a,b,c) {	return page.homeBootstrap(); }
			});
            return this;
		};

        // view page initializer
		this.viewBootstrap = function() {
			var content = currentDdoc.views[entityname].map;
			bh = new bespinHandler ( 
				$("#designer div.editor") , 
				$("#designer div.editorStatusBar") , 
				content, {}
			);

			var current = "map";
			var buffer_text = "";
			var buffer_template = "";
			if ( currentDdoc.views[entityname].reduce ) {
				buffer_text = currentDdoc.views[entityname].reduce;
				buffer_template = currentDdoc.views[entityname].reduce;
			}

			$("#designer div.editorWrapper").removeClass("noview").addClass("view");

			
			$("#designer div.editorSwitcherBar").html("<strong>Map</strong>").show().click(function() {
				if ( current == "map" ) {
					current = "reduce";
					$(this).html("<strong>Reduce</strong>");
				} else {
					current = "map";
					$(this).html("<strong>Map</strong>");
				}
				var tmp_text = bh.getValue();
				var tmp_template = bh.getInitialContent();
				bh.setValue(buffer_text).setInitialContent (buffer_template).checkForAChange() ;
				buffer_text = tmp_text;
				buffer_template = tmp_template;
			});

            $("#designer div.editorStatusBar").delegate("span.addTemplate","click", function () {
                codeTemplateListener(current);
            })
            .delegate("span.saveCode","click",
				function () {
					bh.setStatusSaving();
					var cur = current.length ? current : "map";
					currentDdoc.views[entityname][cur] = bh.getValue();
                    if ( !currentDdoc.views[entityname][cur].length ) {
                        delete currentDdoc.views[entityname][cur];
                    }
					db.saveDoc(currentDdoc, {
						"success": function() {
							bh.setStatusSaveResultOk();
							bh.setInitialContent(currentDdoc.views[entityname][cur]);
						},
						"error": function (resp) {
							currentDdoc._rev = resp.rev;
							bh.setStatusSaveResultKo();
						}
					});
				}
			);

			$("#designer table input[name=key]").checkJSON();
			$("#designer table input[name=keys]").checkJSON();
			$("#designer table input[name=startkey]").checkJSON();
			$("#designer table input[name=endkey]").checkJSON();
			$("#designer .viewSettingsHeader .open").click(function() {
				$(this).hide();
				$("#designer table").show();
				$("#designer .viewSettingsHeader .close").show();
			});
			$("#designer .viewSettingsHeader .close").click(function() {
				$(this).hide();
				$("#designer table").hide();
				$("#designer .viewSettingsHeader .open").show();
			});

			$("#designer button.run").click(function () {
				$(this).attr('disabled',"1");
				$("#designer .queryPanel").children().hide();
				$("#designer .queryPanel .querying").show().parent().show();
				var opts = {
					"options": page.viewQuery($("#designer table")),
					"name": currentDdoc._id.substr(8)+'/'+entityname
				};
				// this because jquery.couch.js stringify key,startkey and endkey options
				if ( opts.options.key ) opts.options.key = JSON.parse(opts.options.key);
				if ( opts.options.startkey ) opts.options.startkey = JSON.parse(opts.options.startkey);
				if ( opts.options.endkey ) opts.options.endkey = JSON.parse(opts.options.endkey);
				queryViewToServer(
					$("#designer button.run"),
					$("#designer .queryPanel"),
					opts
				);
			});

		}

        // list page initializer
		this.listBootstrap = function() {
			var content = currentDdoc.lists[entityname];
			bh = new bespinHandler ( 
				$("#designer div.editor") , 
				$("#designer div.editorStatusBar") , content, {}
            );
            $("#designer div.editorStatusBar").delegate("span.addTemplate","click", function () {
                codeTemplateListener("list");
            })
            .delegate("span.saveCode","click",
				function () {
					bh.setStatusSaving();
					currentDdoc.lists[entityname] = bh.getValue();
					db.saveDoc(currentDdoc, {
						"success": function(resp) {
							currentDdoc._rev = resp.rev;
							bh.setStatusSaveResultOk();
							bh.setInitialContent(currentDdoc.lists[entityname]);
						},
						"error": function () {
							bh.setStatusSaveResultKo();
						}
					});
				}
			);

			$("#designer table input[name=key]").checkJSON();
			$("#designer table input[name=keys]").checkJSON();
			$("#designer table input[name=startkey]").checkJSON();
			$("#designer table input[name=endkey]").checkJSON();
			$("#designer .viewSettingsHeader .open").click(function() {
				$(this).hide();
				$("#designer table").show();
				$("#designer .viewSettingsHeader .close").show();
			});
			$("#designer .viewSettingsHeader .close").click(function() {
				$(this).hide();
				$("#designer table").hide();
				$("#designer .viewSettingsHeader .open").show();
			});

			$("#designer button.run").click(function () {
				$(this).attr('disabled',"1");
				$("#designer .queryPanel").children().hide();
				$("#designer .queryPanel .querying").show().parent().show();
				var opts = {
					"options": page.viewQuery($("#designer table")),
					"name": currentDdoc._id.substr(8)+'/'+entityname,
					"view_name": $("#list .viewslisting").text()
				};
				// this because jquery.couch.js stringify key,startkey and endkey options
				if ( opts.options.key ) opts.options.key = JSON.parse(opts.options.key);
				if ( opts.options.startkey ) opts.options.startkey = JSON.parse(opts.options.startkey);
				if ( opts.options.endkey ) opts.options.endkey = JSON.parse(opts.options.endkey);
				queryListToServer(
					$("#designer button.run"),
					$("#designer .queryPanel"),
					opts
				);
			});
			$("#designer button.run").attr("disabled",true);

			$("#list .viewslisting").menuPanel({
				"contentCallback": function(cb) {
					var html = $('<ul></ul>');
					db.allDocs({startkey: "_design/", endkey: "_design0",
						include_docs: true,
						success: function(resp) {
							$(resp.rows).each(function(key,row) {
								if ( 'views' in row.doc ) {
									for ( viewname in row.doc.views ) {
										var tuple = row.doc._id.substr(8) +'/'+ viewname;
										$(html).append("<li attr=\"" + tuple.replace("\"","&quot;") + "\">" + tuple + "</li>");
									}
								}
							});
							cb(html);
						},
						error: function (a,b,c) {
							cb("<p>Sorry, an error occured</p>");
						}
					});
				},
				"class": "menuPanel",
				"beforeDisplay": function (panel) {
					$("li",panel).click(function() {
						var attr = $(this).attr("attr");
						if ( attr ) {
							$("#list .viewslisting").text(attr);
							$("#designer button.run").removeAttr("disabled");
						}
						panel.close();
					});
				}
			});

			$("#list").show();
		}

        // show page initializer
		this.showBootstrap = function() {
			var content = currentDdoc.shows[entityname];
			bh = new bespinHandler ( 
				$("#designer div.editor") , 
				$("#designer div.editorStatusBar") , 
				content, {}
			);
            $("#designer div.editorStatusBar").delegate("span.addTemplate","click", function () {
                codeTemplateListener("show");
            })
            .delegate("span.saveCode","click",
				function () {
					bh.setStatusSaving();
					currentDdoc.shows[entityname] = bh.getValue();
					db.saveDoc(currentDdoc, {
						"success": function(resp) {
							currentDdoc._rev = resp.rev;
							bh.setStatusSaveResultOk();
							bh.setInitialContent(currentDdoc.shows[entityname]);
						},
						"error": function () {
							bh.setStatusSaveResultKo();
						}
					});
				}
			);
			$("#designer .viewSettingsHeader .open").hide();
			$("#designer .viewSettingsHeader .close").hide();

			$("#designer button.run").click(function () {
				$(this).attr('disabled',"1");
				$("#designer .queryPanel").children().hide();
				$("#designer .queryPanel .querying").show().parent().show();
				var opts = {
					"options": page.viewQuery($("#designer table")),
					"name": currentDdoc._id.substr(8)+'/'+entityname,
					"docId": $("#show input[name=docid]").val()
				};
				queryShowToServer(
					$("#designer button.run"),
					$("#designer .queryPanel"),
					opts
				);
			});
			$("#viewoptions").hide();
			$("#show").show();

			$("#show input[name=docid]").james (db.uri+'_all_docs',{
				"ajaxUrl": function ( value_to_send, o ) {
					var bound = value_to_send.substr(0, value_to_send.length-1) + String.fromCharCode(value_to_send.charCodeAt(value_to_send.length-1)+1);
					return {'startkey': '"'+value_to_send+'"', 'endkey': '"'+bound+'"'};
				},
				"onKeystroke": function(data) {
					var back = {};
					if ( data.rows.length < 1 || data.rows.length > 10 ) {	return back;	}
					for(var i=0,len=data.rows.length; value=data.rows[i], i<len; i++) {
						if (value.id) { back[value.id]  = value.id ; }
					}
					return back;
				}
			});

		}

        // home page initializer
		this.homeBootstrap = function () {
			this.db.allDocs({startkey: "_design/", endkey: "_design0",
				include_docs: true,
				success: function(resp) {
					var element = $("#home > div").eq(0);
					$(resp.rows).each(function(key,value) {
						var doc = value.doc;
						var docwrap = $('<div class="ddoc">Design document: <strong>'+doc._id.substr(8)+'</strong></div>');
						for ( var entity in entitylist ) {
							var entityhuman = entitylist[entity];
							var ewrap = $('<div class="entity" attr="'+encodeURIComponent(doc._id)+'">'+entityhuman+'s <span class="link" attr="'+entity+'">New...</span></div>');
                            var enwrap = [];
							if ( entity+'s' in doc ) {
								for ( var ekey in doc[entity+'s'] ) {
    								enwrap.push(
										'<span class="entityname">'+
										'<a href="'+
											window.location.pathname    +'?'+
											encodeURIComponent(dbName)  +'/'+
											doc._id 					+'/'+
											entity                      +'/'+
											encodeURIComponent(ekey)    +'/'+
										'">'+escape(ekey)	+
										'</a>'+
										'</span>'
									);
								}
							}
//                            ewrap.append();
							docwrap.append(ewrap).append('<div>'+enwrap.join(', ')+'</div>');
						}
						element.append(docwrap);
					});
					$("#home").delegate("div.entity span.link[attr=view]","click",function() {
						var attr = $(this).closest('.entity').attr('attr');
						page.addView(decodeURIComponent(attr));
					}).delegate("div.entity span.link[attr=list]","click",function() {
						var attr = $(this).closest('.entity').attr('attr');
						page.addList(decodeURIComponent(attr));
					}).delegate("div.entity span.link[attr=show]","click",function() {
						var attr = $(this).closest('.entity').attr('attr');
						page.addShow(decodeURIComponent(attr));
					});
					$("#wait").hide();
					$("#home").show();
				}
			});
		}

        // parses the view form and returns it as an object
		this.viewQuery = function (elements) {
			var settings = {};
			var current = elements.find('input[name=limit]').val();
			if ( current ) {
				current = parseInt(current);
				if ( current )	settings.limit = current;
			}
			current = elements.find('input[name=skip]').val();
			if ( current ) {
				current = parseInt(current);
				if ( current )	settings.skip = current;
			}

			current = elements.find('input[name=include_docs]:checked');
			if ( current.length ) settings.include_docs = "true";
			current = elements.find('input[name=reduce]:checked');
			if ( current.length ) settings.reduce = "false";
			current = elements.find('input[name=inclusive_end]:checked');
			if ( current.length ) settings.inclusive_end = "false";
			current = elements.find('input[name=stale]:checked');
			if ( current.length ) settings.stale = "ok";
			current = elements.find('input[name=group]:checked');
			if ( current.length ) settings.group = "true";

			current = elements.find('input[name=group_level]').val();
			if ( current ) {
				current = parseInt(current);
				if ( current )	settings.group_level = current;
			}

			current = elements.find('input[name=key]').val();
			if ( current && isValidJSON(current) ) settings.key = current;
			current = elements.find('input[name=startkey]').val();
			if ( current && isValidJSON(current) ) settings.startkey = current;
			current = elements.find('input[name=endkey]').val();
			if ( current && isValidJSON(current) ) settings.endkey = current;
			current = elements.find('input[name=keys]').val();
			if ( current && isValidJSON(current) ) settings.keys = current;

			// for an unknown reason placeholders of those two keys are taken as values by FF 3.6.3...
			current = elements.find('input[name=startkey_docid]').val();
			if ( current && current != elements.find('input[name=startkey_docid]').attr('placeholder') ) settings.startkey_docid = current;
			current = elements.find('input[name=endkey_docid]').val();
			if ( current && current != elements.find('input[name=startkey_docid]').attr('placeholder') ) settings.endkey_docid = current;
			delete current;
			return settings;
		};

        // launch the add view dialog, and add a new view
		this.addView = function(ddoc) {
			$.showDialog("designer/_create_view.html", {
			submit: function(data, callback) {
				if (!data.name || data.name.length == 0) {
				callback({name: "Please enter a name."});
				return;
				}

				db.openDoc(ddoc,{
					error: function(status, id, reason) { callback({name: reason}) },
					success: function(doc) {
						if ( ! doc.views ) {
							doc.views = {};
						}
						if ( doc.views[data.name] ) {
							location.href = "designer.html?" + encodeURIComponent(dbName) +'/_design/'+ encodeURIComponent(ddoc.substr(8))+'/view/'+encodeURIComponent(data.name);
						} else {
							doc.views[data.name] = {'map':""};
							db.saveDoc(doc, {
								error: function(status, id, reason) { callback({name: reason}) },
								success: function(resp) {
									location.href = "designer.html?" + encodeURIComponent(dbName) +'/_design/'+ encodeURIComponent(ddoc.substr(8))+'/view/'+encodeURIComponent(data.name);
									callback();
								}
							});
						}
					}
				});
			}
			});
			return false;
		};

        // launch the add list dialog, and add a new list
		this.addList = function(ddoc) {
			$.showDialog("designer/_create_list.html", {
			submit: function(data, callback) {
				if (!data.name || data.name.length == 0) {
				callback({name: "Please enter a name."});
				return;
				}

				db.openDoc(ddoc,{
					error: function(status, id, reason) { callback({name: reason}) },
					success: function(doc) {
						var redirect = "designer.html?" + encodeURIComponent(dbName) +'/_design/'+ encodeURIComponent(ddoc.substr(8))+'/list/'+encodeURIComponent(data.name);
						if ( ! doc.lists ) {
							doc.lists = {};
						}
						if ( doc.lists[data.name] ) {
							location.href = redirect;
						} else {
							doc.lists[data.name] = "";
							db.saveDoc(doc, {
								error: function(status, id, reason) { callback({name: reason}) },
								success: function(resp) {
									location.href = redirect;
									callback();
								}
							});
						}
					}
				});
			}
			});
			return false;
		};

        // launch the add show dialog, and add a new show
		this.addShow = function(ddoc) {
			$.showDialog("designer/_create_show.html", {
			submit: function(data, callback) {
				if (!data.name || data.name.length == 0) {
				callback({name: "Please enter a name."});
				return;
				}
				db.openDoc(ddoc,{
					error: function(status, id, reason) { callback({name: reason}) },
					success: function(doc) {
						var redirect = "designer.html?" + encodeURIComponent(dbName) +'/_design/'+ encodeURIComponent(ddoc.substr(8))+'/show/'+encodeURIComponent(data.name);
						if ( ! doc.shows ) { doc.shows = {}; }
						if ( doc.shows[data.name] ) { 
                            location.href = redirect;
                        } else {
							doc.shows[data.name] = "";
							db.saveDoc(doc, {
								error: function(status, id, reason) { callback({name: reason}) },
								success: function(resp) {
									location.href = redirect;
									callback();
								}
							});
						}
					}
				});
			}
			});
			return false;
		}

        // set the current design doc
		this.setCurrentDdoc = function(doc) {			currentDdoc = doc;		};
        // get the current design doc
		this.getCurrentDdoc = function() {			return currentDdoc;		};



	}
});


})(jQuery);
