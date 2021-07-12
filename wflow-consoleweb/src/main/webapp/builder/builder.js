/**
 * Customised from https://github.com/givanz/VvvebJs
 */

_CustomBuilder = {
    isAjaxReady : false,
    saveUrl : '',
    previewUrl : '',
    contextPath : '/jw',
    appId: '',
    appVersion: '',
    appPath: '',
    builderType: '',
    builderLabel: '',
    id: '',
    config : {},
    defaultConfig: {
        builder : {
            options : {
                getDefinitionUrl : "",
                rightPropertyPanel : false,
                defaultBuilder : false
            },
            callbacks : {
                initBuilder : "",
                load : "",
                saveEditProperties : "",
                cancelEditProperties : "",
                getBuilderProperties : "",
                saveBuilderProperties : ""
            }
        },
        advanced_tools : {
            tree_viewer : {
                disabled : false,
                childs_properties : ["elements"],
                matchers : {
                    'editable' : {
                        match : function (viewer, deferreds, node, jsonObj, refObj) {
                            if (node.data['parent'] === undefined) {
                                DependencyTree.Util.createEditIndicator(viewer, node, function(){
                                    CustomBuilder.showPopUpBuilderProperties();
                                });
                            } else if (jsonObj['className'] !== undefined) {
                                DependencyTree.Util.createEditIndicator(viewer, node, function() {
                                    CustomBuilder.editProperties(jsonObj["className"], jsonObj["properties"]);
                                });
                            }   

                            return false;
                        }
                    }
                }
            },
            xray : {
                 disabled : true
            },
            usage : {
                disabled : false
            },
            i18n : {
                disabled : false,
                keywords : [
                    "label"
                ],
                options : {
                    sort : true,
                    i18nHash : true
                }
            },
            permission : {
                disabled : false,
                permission_plugin : "org.joget.apps.form.model.FormPermission",
                authorized : {
                    property : "hidden",
                    default_value : "",
                    options : [
                        {
                            key : "visible",
                            value : "",
                            label : get_cbuilder_msg("ubuilder.visible")
                        },
                        {
                            key : "hidden",
                            value : "true",
                            label : get_cbuilder_msg("ubuilder.hidden"),
                            disableChild : true
                        }
                    ]
                },
                unauthorized : {
                    property : "",
                    default_value : "",
                    options : [
                        {
                            key : "visible",
                            value : "",
                            label : get_cbuilder_msg("ubuilder.visible")
                        },
                        {
                            key : "hidden",
                            value : "true",
                            label : get_cbuilder_msg("ubuilder.hidden"),
                            disableChild : true
                        }
                    ]
                },
                element_support_plugin : [],
                childs_properties : ["elements"],
                ignore_classes : [],
                render_elements_callback : ""
            },
            screenshot : {
                disabled : true
            },
            definition : {
                disabled : false
            },
            diffChecker : {
                disabled : false
            },
            customTabsCallback : ""
        }
    },
    propertiesOptions: null,
    
    //undo & redo feature
    undoStack : new Array(),
    redoStack : new Array(),
    undoRedoMax : 50,
    
    json : null,
    data : {},
    paletteElements : {},
    availablePermission : {},
    permissionOptions: null,
    
    //Tracker
    isCtrlKeyPressed : false,
    isAltKeyPressed : false,
    saveChecker : 0,
    
    navCreateNewDialog : null,
    
    cachedAjaxCalls: {},
    
    builderItems : null,
    builderItemsLoading : [],
    
    /*
     * Utility method to call a function by name
     */
    callback : function(name, args) {
        if (name !== "" && name !== undefined && name !== null) {
            var func = PropertyEditor.Util.getFunction(name);
            if (func !== null && func !== undefined) {
                return func.apply(null, args);
            }
        }
    },
    
    /*
     * Used in cbuilder/base.jsp to setup the configuration of the builder 
     */
    initConfig : function (config) {
        CustomBuilder.config = $.extend(true, {}, CustomBuilder.defaultConfig);
        CustomBuilder.config = $.extend(true, CustomBuilder.config, config);
    },
    
    /*
     * Used in cbuilder/base.jsp to setup the properties page of the builder 
     */
    initPropertiesOptions : function(options) {
        CustomBuilder.propertiesOptions = options;
        if (options !== undefined && options !== null && options !== "") {
            $("#properties-btn").show();
        } else {
            $("#properties-btn").hide();
        }
    },
    
    ajaxRenderBuilder: function(url) {
        //check url is same
        var temp = url;
        var hash = ""
        if (url.indexOf("#") > 0) {
            temp = url.substring(0, url.indexOf("#"));
            hash = url.substring(url.indexOf("#"));
        }
        if (window.location.pathname === temp) {
            if (window.location.hash !== hash) {
                window.location.hash = hash.replace("#", "");
            }
            return;
        }
        
        //check if there is unsave changes in current builder
        if (!CustomBuilder.isSaved()) {
            if (!confirm(get_cbuilder_msg('ubuilder.saveBeforeClose'))) {
                return;
            }
        }
        
        if (temp.indexOf("/builders") !== -1) {
            $("#builder_loader").css("color", "#6e9f4b");
            $("#builder_loader i.fa-stack-1x").attr("class", "fas fa-pencil-ruler fa-stack-1x");
        } else {
            var builderLi = $("#builder-menu a[href='"+url+"']").closest(".builder-icon");
            $("#builder_loader").css("color", $(builderLi).find('> span').css("color"));
            $("#builder_loader i.fa-stack-1x").attr("class", $(builderLi).find('> span > i').attr("class") + " fa-stack-1x");
        }
        
        $(".builder-view").remove();
        $(".boxy-content:visible").each(function(){
            var id = $(this).attr("id");
            JPopup.hide(id);
        });
        
        $("#quick-nav-bar").removeClass("active");
        $("body").addClass("initializing");
        
        const headers = new Headers();
        headers.append(ConnectionManager.tokenName, ConnectionManager.tokenValue);
        headers.append("_ajax-rendering", "true");
        
        var args = {
            method : "GET",
            headers: headers
        };
        
        PresenceUtil.message("leave");
        
        fetch(url, args)
        .then(function (response) {
            if (response.url.indexOf("/web/login") !== -1) {
                document.location.href = url;
                return false;
            } else {
                history.pushState({url: response.url+hash}, "", response.url+hash); //handled redirected URL
                return response.text();
            }
        })
        .then(data => {
            $("#design-btn").trigger("click");
    
            CustomBuilder.updatePresenceIndicator();
            
            data = eval("[" + data.trim() + "]")[0];
            
            //to standardize formatting
            var jsonData = JSON.decode(data.builderDefJson);
            $("#cbuilder-json, #cbuilder-json-original, #cbuilder-json-current").val(JSON.encode(jsonData));
            
            $("head title").text(data.title);
            $("#builderElementName .title").html(data.name);
            
            $("#builder_loader").css("color", data.builderColor);
            $("#builder_loader i.fa-stack-1x").attr("class", data.builderIcon + " fa-stack-1x");
            $("#save-btn").removeClass("unsaved");
            
            if (CustomBuilder.builderType === data.builderType && CustomBuilder.builderType !== "app") {
                CustomBuilder.id = data.id;
                CustomBuilder.appId = data.appId;
                CustomBuilder.appVersion = data.appVersion;
                CustomBuilder.appPath = data.appPath;
                CustomBuilder.appPublished = data.appPublished;
                CustomBuilder.saveUrl = data.saveUrl;
                CustomBuilder.previewUrl = data.previewUrl;
                CustomBuilder.undoStack = new Array();
                CustomBuilder.redoStack = new Array();
                CustomBuilder.saveChecker = 0;
            
                $("body").removeClass("initializing");
                if ($("body").hasClass("default-builder")) {
                    CustomBuilder.Builder.selectedEl = null;
                    CustomBuilder.Builder.highlightEl = null;
                }
                CustomBuilder.initConfig(eval("[" + data.builderConfig + "]")[0]);
                CustomBuilder.loadJson($("#cbuilder-json").val());
                CustomBuilder.intBuilderMenu();
            } else {
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks["unloadBuilder"], []);
                $("body").attr("class", "no-right-panel initializing max-property-editor");
                $("#builder_canvas").attr("class", "");
                
                CustomBuilder = $.extend(true, {}, _CustomBuilder); //reset everything
                
                CustomBuilder.id = data.id;
                CustomBuilder.appId = data.appId;
                CustomBuilder.appVersion = data.appVersion;
                CustomBuilder.appPath = data.appPath;
                CustomBuilder.appPublished = data.appPublished;
                CustomBuilder.saveUrl = data.saveUrl;
                CustomBuilder.previewUrl = data.previewUrl;
                CustomBuilder.undoStack = new Array();
                CustomBuilder.redoStack = new Array();
                CustomBuilder.saveChecker = 0;
                CustomBuilder.paletteElements = {};
                CustomBuilder.availablePermission = {};
                CustomBuilder.permissionOptions = null;
                CustomBuilder.builderType = data.builderType;
                CustomBuilder.builderLabel = data.builderLabel;
                CustomBuilder.builderColor = data.builderColor;
                CustomBuilder.builderIcon = data.builderIcon;
                
                //reset builder 
                $("#builderIcon").css("background-color", data.builderColor);
                $("#builderIcon i").attr("class", "fa-2x " + data.builderIcon);
                $("#builderTitle span").text(data.builderLabel);
                $("#builderElementName").css("color", data.builderColor);
                $("#builder_canvas").html(data.builderCanvas);
                $("#left-panel .drag-elements-sidepane .components-list").html("");
                $("#elements-tabs").hide().html('<li class="nav-item component-tab"><a class="nav-link active" id="components-tab" data-toggle="tab" href="#components" role="tab" aria-controls="components" aria-selected="true" title="' + get_cbuilder_msg('cbuilder.elements') + '"/>"><div><small>' + get_cbuilder_msg('cbuilder.elements') + '</small></div></a></li>');
                $("#elements-tabs").next().find(" > :not(#components)").remove();
                $("#top-panel .responsive-buttons").hide();
                $("#builderToolbar .copypaste").hide();
                $("#style-properties-tab-link").hide();
                $("#style-properties-tab-link a").html('<i class="las la-palette"></i> <span>'+get_cbuilder_msg("cbuilder.styles") + '</span>');
                
                $("#left-panel .drag-elements-sidepane").off("mousedown touchstart mouseup touchend");
                
                if ($("body").hasClass("default-builder")) {
                    CustomBuilder.Builder.reset();
                }
                
                //load css and js
                $("style[data-cbuilder-style], link[data-cbuilder-style],script[data-cbuilder-script]").remove();
                $("head").append('<script data-cbuilder-script type="text/javascript" src="'+CustomBuilder.contextPath+'/web/console/i18n/cbuilder?type='+CustomBuilder.builderType+'&build='+CustomBuilder.buildNumber+'"></script>');
                if (data.builderCSS !== "") {
                    $("head").append(data.builderCSS);
                }
                if (data.builderJS !== "") {
                    $("head").append(data.builderJS);
                }
            }
        })
        .catch(error => {
            console.log(error);
        });
    },
    
    /*
     * Used in cbuilder/base.jsp to initialize the builder
     */
    initBuilder: function (callback) {
        if (!CustomBuilder.isAjaxReady) {
            window.onpopstate = function(event) {
                if (event.state) {
                    var url = event.state.url;
                    CustomBuilder.ajaxRenderBuilder(url);
                }
            };
            window.onbeforeunload = function() {
                if(!CustomBuilder.isSaved()){
                    return get_cbuilder_msg("ubuilder.saveBeforeClose");
                }
            };
            
            CustomBuilder.isAjaxReady = true;
        }
        
        CustomBuilder.advancedToolsOptions = {
            contextPath : CustomBuilder.contextPath,
            appId : CustomBuilder.appId,
            appVersion : CustomBuilder.appVersion,
            id : CustomBuilder.id,
            builder : (CustomBuilder.builderType !== "form" && CustomBuilder.builderType !== "userview" && CustomBuilder.builderType !== "datalist")?"custom":CustomBuilder.builderType
        };
        
        if (!CustomBuilder.supportTreeViewer()) {
            $(".advanced-tools #treeviewer-btn").hide();
        } else {
            $(".advanced-tools #treeviewer-btn").show();
        }
        if (!CustomBuilder.supportXray()) {
            $(".advanced-tools #xray-btn").hide();
        } else {
            $(".advanced-tools #xray-btn").show();
        }
        if (!CustomBuilder.supportI18n()) {
            $(".advanced-tools #i18n-btn").hide();
        } else {
            $(".advanced-tools #i18n-btn").show();
        }
        if (!CustomBuilder.supportUsage()) {
            $(".advanced-tools #usages-btn").hide();
        } else {
            $(".advanced-tools #usages-btn").show();
        }
        if (!CustomBuilder.supportPermission()) {
            $(".advanced-tools #permission-btn").hide();
        } else {
            $(".advanced-tools #permission-btn").show();
        }
        if (!CustomBuilder.supportScreenshot()) {
            $(".advanced-tools #screenshot-btn").hide();
        } else {
            $(".advanced-tools #screenshot-btn").show();
        }
        if (!CustomBuilder.supportDiffChecker()) {
            $(".advanced-tools #diff-checker-btn").hide();
        } else {
            $(".advanced-tools #diff-checker-btn").show();
        }
        if (!CustomBuilder.supportDefinition()) {
            $(".advanced-tools #json-def-btn").hide();
        } else {
            $(".advanced-tools #json-def-btn").show();
        }
        
        if (CustomBuilder.previewUrl !== "") {
            $("#preview-btn").show();
        } else {
            $("#preview-btn").hide();
        }
        
        if (CustomBuilder.config.builder.options['rightPropertyPanel'] === true) {
            $("body").addClass("property-editor-right-panel");
        } else {
            $("body").removeClass("property-editor-right-panel");
        }
        
        if (CustomBuilder.getBuilderSetting("autoApplyChanges") === true) {
            $("#toggleAutoApplyChange").addClass("toggle-enabled").removeClass("toggle-disabled");
            $("#toggleAutoApplyChange").attr("title", get_cbuilder_msg("cbuilder.disableAutoApplyChanges"));
        } else {
            $("#toggleAutoApplyChange").addClass("toggle-disabled").removeClass("toggle-enabled");
            $("#toggleAutoApplyChange").attr("title", get_cbuilder_msg("cbuilder.enableAutoApplyChanges"));
        }
        
        var builderCallback = function(){
            var jsonData = JSON.decode($("#cbuilder-json").val());
            $("#cbuilder-json, #cbuilder-json-original, #cbuilder-json-current").val(JSON.encode(jsonData));
            
            if (callback) {
                callback();
            }
            
            if (CustomBuilder.config.advanced_tools.permission.permission_plugin !== undefined && CustomBuilder.config.advanced_tools.permission.permission_plugin !== "") {
                CustomBuilder.initPermissionList(CustomBuilder.config.advanced_tools.permission.permission_plugin);
            }
            
            $("[data-cbuilder-action]").each(function () {
                var on = "click";
                var target = $(this);
                if (this.dataset.cbuilderOn)
                    on = this.dataset.cbuilderOn;
                
                var action = CustomBuilder[this.dataset.cbuilderAction];
                if (CustomBuilder.config.builder.callbacks[this.dataset.cbuilderAction] !== undefined && CustomBuilder.config.builder.callbacks[this.dataset.cbuilderAction] !== "") {
                    var func = PropertyEditor.Util.getFunction(CustomBuilder.config.builder.callbacks[this.dataset.cbuilderAction]);
                    if (func !== null && func !== undefined) {
                        action = func;
                    }
                }
                
                var buttonAction = function(event) {
                    if ($(target).is(":visible") && !$(target).hasClass("disabled")) {
                        action.call(this, event);
                    }
                    return false;
                };
                $(this).off(on);
                $(this).on(on, buttonAction);
                if (this.dataset.cbuilderShortcut)
                {
                    $(document).unbind('keydown.shortcut', this.dataset.cbuilderShortcut);
                    $(document).bind('keydown.shortcut', this.dataset.cbuilderShortcut, buttonAction);
                    if (window.FrameDocument) {
                        $(window.FrameDocument).unbind('keydown.shortcut', this.dataset.cbuilderShortcut);
                        $(window.FrameDocument).bind('keydown.shortcut', this.dataset.cbuilderShortcut, buttonAction);
                    }
                }
            });
            
            CustomBuilder.customAdvancedToolTabs();
            
            $(document).uitooltip({
                position: { my: "left top+5", at: "left bottom", collision: "flipfit" },
                open: function (event, ui) {
                    if ($(event.originalEvent.target).is("iframe")) {
                        $(ui.tooltip).hide();
                        return false;
                    }
                    var el = $(event.originalEvent.target).closest('[title]');
                    var position = el.attr('tooltip-position');
                    if (position === "right") {
                        var offset = el.offset();
                        $(ui.tooltip).css("left", (offset.left + el.width() + 5) + "px");
                        $(ui.tooltip).css("top", (offset.top + 5) + "px");
                    }
                },
                close: function (event, ui) {
                    $(".ui-helper-hidden-accessible").remove();
                } 
            });
            
            CustomBuilder.builderFavIcon();
            CustomBuilder.updateBuilderBasedOnSettings();
            
            $("body").removeClass("initializing");
            CustomBuilder.intBuilderMenu();
        };
        
        CustomBuilder.callback(CustomBuilder.config.builder.callbacks["initBuilder"], [builderCallback]);
    },
    
    /*
     * Change the builder fav icon to the builder color
     */
    builderFavIcon : function() {
        setTimeout(function(){
            var faviconSize = 32;
            var canvas = document.createElement('canvas');
            canvas.width = faviconSize;
            canvas.height = faviconSize;

            var context = canvas.getContext('2d');
            context.fillStyle = CustomBuilder.builderColor;
            context.fillRect(0, 0, faviconSize, faviconSize);

            var img = new Image();
            img.onload = function() {
                context.drawImage(img, 4, 4, 24, 24);
                $("#favicon").attr("href",canvas.toDataURL('image/png'));
            }
            img.src = CustomBuilder.contextPath + "/builder/favicon.svg";
        }, 1);
    },
    
    /*
     * Based on cache, setting up the advanced tools during builder initializing
     */
    updateBuilderBasedOnSettings : function() {
        var builderSetting = null;
        var builderSettingJson = $.localStorage.getItem(CustomBuilder.builderType+"-settings");
        if (builderSettingJson !== null && builderSettingJson !== undefined) {
            builderSetting = JSON.decode(builderSettingJson);
        } else {
            builderSetting = {
                advanceTools : false
            };
            $.localStorage.setItem(CustomBuilder.builderType+"-settings", JSON.encode(builderSetting));
        }
        
        if (builderSetting.advanceTools !== undefined && builderSetting.advanceTools === true) {
            $("body").addClass("advanced-tools-supported");
        } else {
            $("body").removeClass("advanced-tools-supported");
        }
    },
    
    /*
     * Update builder setting in cache
     */
    setBuilderSetting : function(key, value) {
        var builderSetting = null;
        var builderSettingJson = $.localStorage.getItem(CustomBuilder.builderType+"-settings");
        if (builderSettingJson !== null && builderSettingJson !== undefined) {
            builderSetting = JSON.decode(builderSettingJson);
        } else {
            builderSetting = {
                rightPanel : true,
                advanceTools : false
            };
        }
        builderSetting[key] = value;
        $.localStorage.setItem(CustomBuilder.builderType+"-settings", JSON.encode(builderSetting));
    },
    
    /*
     * Get builder setting in cache
     */
    getBuilderSetting : function(key) {
        var builderSetting = null;
        var builderSettingJson = $.localStorage.getItem(CustomBuilder.builderType+"-settings");
        if (builderSettingJson !== null && builderSettingJson !== undefined) {
            builderSetting = JSON.decode(builderSettingJson);
        } else {
            builderSetting = {
                rightPanel : true,
                advanceTools : false
            };
            $.localStorage.setItem(CustomBuilder.builderType+"-settings", JSON.encode(builderSetting));
        }
        return builderSetting[key];
    },
    
    showPopUpBuilderProperties : function() {
        
    },
    
    /*
     * Retrieve the properties value for Properties page
     */
    getBuilderProperties : function() {
        if (CustomBuilder.config.builder.callbacks["getBuilderProperties"] !== "") {
            return CustomBuilder.callback(CustomBuilder.config.builder.callbacks["getBuilderProperties"], []);
        } else {
            return CustomBuilder.data.properties;
        }
    },
    
    /*
     * Save the properties value in Properties page
     */
    saveBuilderProperties : function(container, properties) {
        if (CustomBuilder.config.builder.callbacks["saveBuilderProperties"] !== "") {
            CustomBuilder.callback(CustomBuilder.config.builder.callbacks["saveBuilderProperties"], [container, properties]);
        } else {
            var builderProperties = CustomBuilder.getBuilderProperties();
            builderProperties = $.extend(builderProperties, properties);
            CustomBuilder.update();
        }
    },
    
    /*
     * Used to create additional palette tabs
     */
    initPaletteElmentTabs : function(defaultTab, tabs) {
        $("#elements-tabs").show();
        $("#components-tab").attr("title", defaultTab.label);
        $("#components-tab small").text(defaultTab.label);
        if (defaultTab.image !== undefined && defaultTab.image !== "") {
            $("#components-tab").prepend('<img src="'+defaultTab.image+'" />');
        }
        
        if (tabs !== undefined && tabs.length > 0) {
            for (var i in tabs) {
                var li = $('<li class="nav-item component-tab"><a class="nav-link" id="'+tabs[i].name+'-tab" data-toggle="tab" href="#'+tabs[i].name+'" role="tab" aria-controls="'+tabs[i].name+'" aria-selected="false" title="'+tabs[i].label+'"><div><small>'+tabs[i].label+'</small></div></a></li>');
                if (tabs[i].image !== undefined && tabs[i].image !== "") {
                    $(li).find("a").prepend('<img src="'+tabs[i].image+'" />');
                }
                $("#elements-tabs").append(li);
                
                var tabPane = $('<div class="tab-pane fade" id="'+tabs[i].name+'" role="tabpanel" aria-labelledby="'+tabs[i].name+'-tab"> \
                        <div class="search"> \
                            <input class="form-control form-control-sm component-search" placeholder="'+get_cbuilder_msg("cbuilder.searchPalette")+'" type="text" data-cbuilder-action="tabSearch" data-cbuilder-on="keyup"> \
                            <button class="clear-backspace"  data-cbuilder-action="clearTabSearch"> \
                                <i class="la la-close"></i> \
                            </button> \
                        </div> \
                        <div class="drag-elements-sidepane sidepane"> \
                            <div> \
                                <ul class="components-list clearfix" data-type="leftpanel"> \
                                </ul>\
                            </div> \
                        </div> \
                    </div>');
                
                $("#elements-tabs").next().append(tabPane);
            }
        }
    },
    
    /*
     * Add element to palette
     */
    initPaletteElement : function(category, className, label, icon, propertyOptions, defaultPropertiesValues, render, css, metaData, tab){
        if (this.paletteElements[className] !== undefined) {
            return;
        }
        if (tab === undefined || tab === "") {
            tab = "components";
        }
        if ((typeof propertyOptions) === "string") {
            try {
                propertyOptions = eval(propertyOptions);
            } catch (err) {
                if (console.log) {
                    console.log("error retrieving properties options of " + label + " : " + err);
                }
                return;
            }
        }
        if ((typeof defaultPropertiesValues) === "string") {
            try {
                defaultPropertiesValues = eval("["+defaultPropertiesValues+"]")[0];
            } catch (err) {
                if (console.log) {
                    console.log("error retrieving default property values of " + label + " : " + err);
                }
                return;
            }
        }
        
        if (css === undefined || css === null) {
            css = "";
        }
        
        var licss = "";
        if (metaData !== undefined && metaData.list_css !== undefined) {
            licss = metaData.list_css;
        }
        
        this.paletteElements[className] = new Object();
        this.paletteElements[className]['className'] = className;
        this.paletteElements[className]['label'] = label;
        this.paletteElements[className]['propertyOptions'] = propertyOptions;
        this.paletteElements[className]['properties'] = defaultPropertiesValues;
        
        var iconObj = null;
        var iconStr = "";
        if (icon !== undefined && icon !== null && icon !== "") {
            try {   
                iconObj = $(icon);
                iconStr = icon;
            } catch (err) {
                iconObj =  $('<span class="image" style="background-image:url(\'' + CustomBuilder.contextPath + icon + '\');"></span>');
                iconStr = '<span class="image" style="background-image:url(\'' + CustomBuilder.contextPath + icon + '\');" ></span>';
            }
        } else {
            iconObj = $('<i class="fas fa-th-large"></i>');
            iconStr = '<i class="fas fa-th-large"></i>';
        }
        this.paletteElements[className]['icon'] = iconStr;
        
        if (metaData !== undefined && metaData !== null) {
            this.paletteElements[className] = $.extend(this.paletteElements[className], metaData);
        }

        if (render === undefined || render !== false) {
            var categoryId = CustomBuilder.createPaletteCategory(category, tab);
            var container = $('#'+ tab + '_comphead_' + categoryId + '_list');

            var li = $('<li class="'+licss+'"><div id="'+className.replaceAll(".", "_")+'" element-class="'+className+'" class="builder-palette-element '+css+'"> <a href="#">'+UI.escapeHTML(label)+'</a></div></li>');
            $(li).find('.builder-palette-element').prepend(iconObj);
            $(container).append(li);
        }
    },
    
    /*
     * Add palette category to tab
     */
    createPaletteCategory : function(category, tab) {
        if (tab === undefined || tab === "") {
            tab = "components";
        }
        
        var categoryId = "default";
        if (category === undefined || category === null || category === "") {
            category = "&nbsp;";
        } else {
            categoryId = category.replace(/\s/g , "-");
            if (!/^[A-Za-z][-A-Za-z0-9_:.]*$/.test(categoryId)) {
                categoryId = "palette-" + CustomBuilder.hashCode(category);
            }
        }
        var list = $("#"+tab + " .components-list");
        if ($('#'+ tab + '_comphead_' + categoryId + '_list').length === 0) {
            list.append('<li class="header clearfix" data-section="' + tab + '-' + categoryId + '"  data-search=""><label class="header" for="' + tab + '_comphead_' + categoryId + '">' + category + '  <div class="la la-angle-down header-arrow"></div>\
                            </label><input class="header_check" type="checkbox" checked="true" id="' + tab + '_comphead_' + categoryId + '">  <ol id="' + tab + '_comphead_' + categoryId + '_list"></ol></li>');
        }
        return categoryId;
    },
    
    /*
     * Remove a category from palette
     */
    clearPaletteCategory : function(category, tab) {
        if (tab === undefined || tab === "") {
            tab = "components";
        }
        
        var categoryId = "default";
        if (category === undefined || category === null || category === "") {
            category = "&nbsp;";
        } else {
            categoryId = category.replace(/\s/g , "-");
            if (!/^[A-Za-z][-A-Za-z0-9_:.]*$/.test(categoryId)) {
                categoryId = "palette-" + CustomBuilder.hashCode(category);
            }
        }
        var list = $("#"+tab + " .components-list");
        var container = $('#'+ tab + '_comphead_' + categoryId + '_list');
        
        $(container).find("[element-class]").each(function() {
            var className = $(this).attr("element-class");
            delete CustomBuilder.paletteElements[className];
        });
        
        container.html("");
    },
    
    /*
     * Retrieve permission plugin available for the builder
     */
    initPermissionList : function(classname){
        $.getJSON(
            CustomBuilder.contextPath + '/web/property/json/getElements?classname=' + classname,
            function(returnedData){
                if (returnedData !== null && returnedData !== undefined) {
                    CustomBuilder.permissionOptions = returnedData;
                    for (e in returnedData) {
                        if (returnedData[e].value !== "") {
                            CustomBuilder.availablePermission[returnedData[e].value] = returnedData[e].label;
                        }
                    }
                }
            }
        );
    },
    
    /*
     * Load and render the JSON data to canvas
     */
    loadJson : function(json, addToUndo) {
        CustomBuilder.json = json;
        try {
            CustomBuilder.data = JSON.decode(json);
        } catch (e) {}
        
        //callback to render json
        CustomBuilder.callback(CustomBuilder.config.builder.callbacks["load"], [CustomBuilder.data]);
    },
    
    /*
     * Update JSON data base on CustomBuilder.data
     */
    update : function(addToUndo) {
        CustomBuilder.callback(CustomBuilder.config.builder.callbacks["beforeUpdate"], [CustomBuilder.data]);
        
        var json = JSON.encode(CustomBuilder.data);
        CustomBuilder.updateJson(json, addToUndo);
        CustomBuilder.updatePasteIcons();
    },
    
    /*
     * Update JSON data
     */
    updateJson : function (json, addToUndo) {
        if (CustomBuilder.json !== null && addToUndo !== false && CustomBuilder.json !== json) {
            CustomBuilder.addToUndo();
        }
        
        CustomBuilder.json = json;
        CustomBuilder.adjustJson();
        
        //update save button
        $("#save-btn").removeClass("unsaved");
        if (!CustomBuilder.isSaved()) {
            $("#save-btn").addClass("unsaved");
        }
    },
    
    /*
     * Get the generated JSON
     */
    getJson : function () {
        return CustomBuilder.json;
    },
    
    /*
     * Save JSON 
     */
    save : function(){
        var proceedSave = true;
        
        if (CustomBuilder.config.builder.callbacks["builderBeforeSave"] !== undefined &&
                CustomBuilder.config.builder.callbacks["builderBeforeSave"] !== "") {
            proceedSave = CustomBuilder.callback(CustomBuilder.config.builder.callbacks["builderBeforeSave"]);
        }
        
        if (proceedSave) {
            CustomBuilder.showMessage(get_cbuilder_msg('cbuilder.saving'));
            var self = CustomBuilder;
            var json = CustomBuilder.getJson();
            $.post(CustomBuilder.saveUrl, {json : json} , function(data) {
                var d = JSON.decode(data);
                if(d.success == true){
                    $("#save-btn").removeClass("unsaved");
                    $('#cbuilder-json-original').val(json);
                    CustomBuilder.updateSaveStatus("0");
                    CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.saved'), "success");

                    CustomBuilder.callback(CustomBuilder.config.builder.callbacks["builderSaved"]);
                }else{
                    CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.saveFailed') + ((d.error && d.error !== "")?(" : " + d.error):""), "danger");

                    CustomBuilder.callback(CustomBuilder.config.builder.callbacks["builderSaveFailed"]);
                }
            }, "text");
        }
    },

    /*
     * Preview generated JSON result
     */
    preview : function() {
        $('#cbuilder-json').val(CustomBuilder.getJson());
        $('#cbuilder-preview').attr("action", CustomBuilder.previewUrl);
        $('#cbuilder-preview').submit();
        return false;
    },
    
    /*
     * Used by advanced tool definition tab to update JSON
     */
    updateFromJson: function() {
        var json = $('#cbuilder-json').val();
        if (CustomBuilder.getJson() !== json) {
            CustomBuilder.loadJson(json);
        }
        return false;
    },
    
    /*
     * Undo the changes from stack
     */
    undo : function(){
        if(CustomBuilder.undoStack.length > 0){
            //if redo stack is full, delete first
            if(CustomBuilder.redoStack.length >= CustomBuilder.undoRedoMax){
                CustomBuilder.redoStack.splice(0,1);
            }

            //save current json data to redo stack
            CustomBuilder.redoStack.push(CustomBuilder.getJson());

            CustomBuilder.loadJson(CustomBuilder.undoStack.pop(), false);

            //enable redo button if it is disabled previously
            if(CustomBuilder.redoStack.length === 1){
                $('#redo-btn').removeClass('disabled');
            }

            //if undo stack is empty, disabled undo button
            if(CustomBuilder.undoStack.length === 0){
                $('#undo-btn').addClass('disabled');
            }

            CustomBuilder.updateSaveStatus("-");
        }
    },

    /*
     * Redo the changes from stack
     */
    redo : function(){
        if(CustomBuilder.redoStack.length > 0){
            //if undo stack is full, delete first
            if(CustomBuilder.undoStack.length >= CustomBuilder.undoRedoMax){
                CustomBuilder.undoStack.splice(0,1);
            }

            //save current json data to undo stack
            CustomBuilder.undoStack.push(CustomBuilder.getJson());

            CustomBuilder.loadJson(CustomBuilder.redoStack.pop(), false);

            //enable undo button if it is disabled previously
            if(CustomBuilder.undoStack.length === 1){
                $('#undo-btn').removeClass('disabled');
            }

            //if redo stack is empty, disabled redo button
            if(CustomBuilder.redoStack.length === 0){
                $('#redo-btn').addClass('disabled');
            }

            CustomBuilder.updateSaveStatus("+");
        }
    },
    
    /*
     * Add changes JSON to stack
     */
    addToUndo : function(json){
        //if undo stack is full, delete first
        if(CustomBuilder.undoStack.length >= CustomBuilder.undoRedoMax){
            CustomBuilder.undoStack.splice(0,1);
        }
        
        if (json === null || json === undefined) {
            json = CustomBuilder.getJson();
        }

        //save current json data to undo stack
        CustomBuilder.undoStack.push(json);

        //enable undo button if it is disabled previously
        if(CustomBuilder.undoStack.length === 1){
            $('#undo-btn').removeClass('disabled');
        }

        CustomBuilder.updateSaveStatus("+");
    },
    
    /*
     * Update the JSON for preview and advanced tools definition tab, then trigger 
     * a change event
     */
    adjustJson: function() {
        // update JSON
        $('#cbuilder-json').val(CustomBuilder.getJson()).trigger("change");
    },
    
    /*
     * Track the save status
     */
    updateSaveStatus : function(mode){
        if(mode === "+"){
            CustomBuilder.saveChecker++;
        }else if(mode === "-"){
            CustomBuilder.saveChecker--;
        }else if(mode === "0"){
            CustomBuilder.saveChecker = 0;
        }
    },
    
    /*
     * Show notifcation message
     */
    showMessage: function(message, type) {
        if (message && message !== "") {
            var id = "toast-" + (new Date()).getTime();
            var delay = 3000;
            if (type === undefined) {
                type = "secondary";
                delay = 1500;
            }
            var toast = $('<div id="'+id+'" role="alert" aria-live="assertive" aria-atomic="true" class="toast alert-dismissible toast-'+type+'" data-autohide="true">\
                '+message+'\
                <button type="button" class="close" data-dismiss="toast" aria-label="'+get_cbuilder_msg("cbuilder.close")+'">\
                    <span aria-hidden="true">&times;</span>\
                </button>\
              </div>');
            
            $("#builder-message").append(toast);
            $('#'+id).toast({delay : delay});
            $('#'+id).toast("show");
            $('#'+id).on('hidden.bs.toast', function () {
                $('#'+id).remove();
            });
        }
    },
    
    /*
     * Retrieve copied element in cache
     */
    getCopiedElement : function() {
        var time = $.localStorage.getItem("customBuilder_"+CustomBuilder.builderType+".copyTime");
        //10 mins
        if (time !== undefined && time !== null && ((new Date()) - (new Date(time))) > 3000000) {
            $.localStorage.removeItem("customBuilder_"+CustomBuilder.builderType+".copyTime");
            $.localStorage.removeItem("customBuilder_"+CustomBuilder.builderType+".copy");
            return null;
        }
        var copied = $.localStorage.getItem("customBuilder_"+CustomBuilder.builderType+".copy");
        if (copied !== undefined && copied !== null) {
            return JSON.decode(copied);
        }
        return null;
    },
    
    /*
     * Copy an element
     */
    copy : function(element, type) {
        var copy = new Object();
        copy['type'] = type;
        copy['object'] = element;
        
        $.localStorage.setItem("customBuilder_"+CustomBuilder.builderType+".copy", JSON.encode(copy));
        $.localStorage.setItem("customBuilder_"+CustomBuilder.builderType+".copyTime", new Date());
        CustomBuilder.updatePasteIcon(type);
        CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.copied'), "info");
    },
    
    /*
     * Update paste icon based on copied element 
     * Not used in DX8, it is for backward compatible
     */
    updatePasteIcon : function(type) {
        $(".element-paste").addClass("disabled");
        $(".element-paste."+type).removeClass("disabled");
    },
    
    /*
     * Update paste icon based on copied element 
     * Not used in DX8, it is for backward compatible
     */
    updatePasteIcons : function() {
        var type = "dummyclass";
        var copied = CustomBuilder.getCopiedElement();
        if (copied !== null) {
            type = copied['type'];
        }
        CustomBuilder.updatePasteIcon(type);
    },
    
    /*
     * Check the diff before save and also use for advanced tool check diff tab
     */
    showDiff : function (callback, output) {
        var jsonUrl = "";
        if (CustomBuilder.config.builder.options["getDefinitionUrl"] !== "") {
            jsonUrl = CustomBuilder.config.builder.options["getDefinitionUrl"];
        } else {
            jsonUrl = CustomBuilder.contextPath + '/web/json/console/app/' + CustomBuilder.appId + '/' + CustomBuilder.appVersion + '/cbuilder/'+CustomBuilder.builderType+'/json/' + CustomBuilder.data.properties.id;
        }
        
        var thisObject = CustomBuilder;
        var merged;
        var currentSaved;
        $.ajax({
            type: "GET",
            url: jsonUrl,
            dataType: 'json',
            success: function (data) {
                var current = data;
                var currentString = JSON.stringify(data);
                currentSaved = currentString;
                $('#cbuilder-json-current').val(currentString);
                var original = JSON.decode($('#cbuilder-json-original').val());
                var latest = JSON.decode($('#cbuilder-json').val());
                merged = DiffMerge.merge(original, current, latest, output);
            },
            error: function() {
                currentSaved = $('#cbuilder-json-current').val();
                merged = $('#cbuilder-json').val();
            },
            complete: function() {
                if (callback) {
                    callback.call(thisObject, currentSaved, merged);
                }    
            }
        });
    },
    
    /*
     * Merge the diff between local and remote
     */
    merge: function (callback) {
        // get current remote definition
        CustomBuilder.showMessage(get_cbuilder_msg('ubuilder.merging'));
        var thisObject = CustomBuilder;
        
        CustomBuilder.showDiff(function (currentSaved, merged) {
            if (currentSaved !== undefined && currentSaved !== "") {
                $('#cbuilder-json-original').val(currentSaved);
            }
            if (merged !== undefined && merged !== "") {
                $('#cbuilder-json').val(merged);
            }
            CustomBuilder.updateFromJson();
            
            if (callback) {
                callback.call(thisObject, merged);
            }
        });
    },
    
    /*
     * Merge remote change and save
     */
    mergeAndSave: function() {
        if ($("body").hasClass("property-editor-right-panel") && !$("body").hasClass("no-right-panel")) {
            CustomBuilder.checkChangeBeforeCloseElementProperties(function(){
                $("body").addClass("no-right-panel");
                CustomBuilder.merge(CustomBuilder.save);
            });
        } else {
            CustomBuilder.merge(CustomBuilder.save);
        }
    }, 
    
    /*
     * Builder support tree viewer in advanced tool based on config
     */
    supportTreeViewer: function() {
        return CustomBuilder.config.builder.options['rightPropertyPanel'] === true && !CustomBuilder.config.advanced_tools.tree_viewer.disabled;
    },
    
    /*
     * Builder support xray viewer in advanced tool based on config
     */
    supportXray: function() {
        return !CustomBuilder.config.advanced_tools.xray.disabled;
    },
    
    /*
     * Builder support i18n editor in advanced tool based on config
     */
    supportI18n: function() {
        return !CustomBuilder.config.advanced_tools.i18n.disabled;
    },
    
    /*
     * Builder support check usage in advanced tool based on config
     */
    supportUsage: function() {
        return !CustomBuilder.config.advanced_tools.usage.disabled;
    },
    
    /*
     * Builder support permission editor in advanced tool based on config
     */
    supportPermission: function() {
        return !CustomBuilder.config.advanced_tools.permission.disabled;
    },
    
    /*
     * Builder support screenshot in advanced tool based on config
     */
    supportScreenshot: function() {
        return !CustomBuilder.config.advanced_tools.screenshot.disabled;
    },
    
    /*
     * Builder support diff checker in advanced tool based on config
     */
    supportDiffChecker: function() {
        return !CustomBuilder.config.advanced_tools.diffChecker.disabled;
    },
    
    /*
     * Builder support definition in advanced tool based on config
     */
    supportDefinition: function() {
        return !CustomBuilder.config.advanced_tools.definition.disabled;
    },
    
    /*
     * Used to initialize additional advanced tool tabs in toolbar
     */
    customAdvancedToolTabs: function() {
        CustomBuilder.callback(CustomBuilder.config.advanced_tools["customTabsCallback"]);
    },
    
    /*
     * Used by advanced tool permission tab to retrieve element label
     */
    getPermissionElementLabel: function(element) {
        if (element["className"] !== undefined && element["className"] !== "") {
            var plugin = CustomBuilder.paletteElements[element["className"]];
            if (plugin !== null && plugin !== undefined) {
                return plugin.label;
            }
        }
        return "";
    },
    
    /*
     * Deprecated
     */
    saveBuilderPropertiesfunction(container, properties){
        CustomBuilder.data.properties = $.extend(CustomBuilder.data.properties, properties);
        CustomBuilder.update();

        $('#step-design').click();
    },
    
    /*
     * Edit an element properties in right panel or popup dialog
     */
    editProperties: function(elementClass, elementProperty, elementObj, element) {
        $(".element-properties .nav-tabs .nav-link").removeClass("has-properties-errors");
        
        var paletteElement = CustomBuilder.paletteElements[elementClass];
        
        if (paletteElement === undefined) {
            return;
        }
        var elementOptions = paletteElement.propertyOptions;
        if (paletteElement.builderTemplate !== undefined && paletteElement.builderTemplate.customPropertyOptions !== undefined) {
            elementOptions = paletteElement.builderTemplate.customPropertyOptions(elementOptions, element, elementObj, paletteElement);
        }
        
        // show property dialog
        var options = {
            appPath: "/" + CustomBuilder.appId + "/" + CustomBuilder.appVersion,
            contextPath: CustomBuilder.contextPath,
            propertiesDefinition : elementOptions,
            propertyValues : elementProperty,
            showCancelButton:true,
            changeCheckIgnoreUndefined: true,
            cancelCallback: function() {
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks["cancelEditProperties"], [elementObj, element]);
            },
            saveCallback: function(container, properties) {
                elementProperty = $.extend(elementProperty, properties);
                
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks["saveEditProperties"], [container, elementProperty, elementObj, element]);
                CustomBuilder.update();
            }
        };
        
        if ($("body").hasClass("property-editor-right-panel")) {
            CustomBuilder.clearPropertySearch();
            $("#right-panel #element-properties-tab").find(".property-editor-container").remove();
            
            options['editorPanelMode'] = true;
            options['showCancelButton'] = false;
            options['closeAfterSaved'] = false;
            options['saveCallback'] = function(container, properties) {
                var d = $(container).find(".property-editor-container").data("deferred");
                var currentElement = element;
                
                if (currentElement && $("body").hasClass("default-builder") && !$(currentElement).is(CustomBuilder.Builder.selectedEl)) {
                    currentElement = CustomBuilder.Builder.selectedEl;
                }
                
                d.resolve({
                    container :container, 
                    prevProperties : elementProperty, 
                    properties : properties, 
                    elementObj : elementObj,
                    element : currentElement
                });
            };
            options['validationFailedCallback'] = function(container, errors) {
                var d = $(container).find(".property-editor-container").data("deferred");
                var currentElement = element;
                
                if (currentElement && $("body").hasClass("default-builder") && !$(currentElement).is(CustomBuilder.Builder.selectedEl)) {
                    currentElement = CustomBuilder.Builder.selectedEl;
                }
                
                d.resolve({
                    container :container,  
                    prevProperties : elementProperty, 
                    errors : errors, 
                    elementObj : elementObj,
                    element : currentElement
                });
            };
            
            $("#right-panel #element-properties-tab").propertyEditor(options);
            if ($("body").hasClass("max-property-editor")) {
                CustomBuilder.adjustPropertyPanelSize();
            }
            
            $("#element-properties-tab-link").show();
        } else {
            // show popup dialog
            if (!PropertyEditor.Popup.hasDialog(CustomBuilder.builderType+"-property-editor")) {
                PropertyEditor.Popup.createDialog(CustomBuilder.builderType+"-property-editor");
            }
            PropertyEditor.Popup.showDialog(CustomBuilder.builderType+"-property-editor", options);
        }
    },
    
    /*
     * Save element properties/styles changes when apply button (tick icon) in right panel is pressed
     */
    applyElementProperties : function(callback) {
        var button = $(this);
        button.attr("disabled", "");
        $(".element-properties .nav-tabs .nav-link").removeClass("has-properties-errors");
        
        var deferreds = [];
                        
        $(".element-properties .property-editor-container").each(function() {
            var d = $.Deferred();
            deferreds.push(d);
            $(this).data("deferred", d);
            
            $(this).find(".page-button-save").first().trigger("click");
        });
        
        $.when.apply($, deferreds).then(function() {
            var container = $(arguments[0].container);
            var prevProperties = arguments[0].prevProperties;
            var element = $(arguments[0].element);
            var elementObj = arguments[0].elementObj;
            var hasError = false;
            
            for (var i in arguments) {
                if (arguments[i].errors !== undefined) {
                    hasError = true;
                    var id = $(arguments[i].container).attr("id");
                    $(".element-properties .nav-tabs .nav-link[href='#"+id+"']").addClass("has-properties-errors");
                }
            }
            
            if (!hasError) {
                var elementProperty = prevProperties;
                var oldPropertiesJson = JSON.encode(elementProperty);
                
                for (var i in arguments) {
                    $.extend(elementProperty, arguments[i].properties);
                }
                
                //clean unuse styling 
                for (var property in elementProperty) {
                    if (elementProperty.hasOwnProperty(property)) {
                        if ((property.indexOf('attr-') === 0 || property.indexOf('css-') === 0 || property.indexOf('style-') === 0
                            || property.indexOf('-attr-') > 0 || property.indexOf('-css-') > 0 || property.indexOf('-style-') > 0) 
                            && elementProperty[property] === "") {
                            delete elementProperty[property];
                        }
                    }
                }
                
                var newPropertiesJson = JSON.encode(elementProperty);
                if (oldPropertiesJson !== newPropertiesJson) {
                    CustomBuilder.callback(CustomBuilder.config.builder.callbacks["saveEditProperties"], [container, elementProperty, elementObj, element]);
                    
                    if ($("body").hasClass("default-builder")) {
                        var updateDeferreds = [];
                        var dummy = $.Deferred();
                        updateDeferreds.push(dummy);
                        CustomBuilder.Builder.updateElement(elementObj, element, updateDeferreds);
                        dummy.resolve();
                        $.when.apply($, updateDeferreds).then(function() {
                            button.removeAttr("disabled");
                            if (callback && $.isFunction(callback)) {
                                callback();
                            }
                        });
                    } else {
                        button.removeAttr("disabled");
                        if (callback && $.isFunction(callback)) {
                            callback();
                        }
                    }
                    CustomBuilder.update();
                    CustomBuilder.showMessage(get_cbuilder_msg("cbuilder.newChangesApplied"), "success");
                } else {
                    if (callback && $.isFunction(callback)) {
                        callback();
                    }
                }
            } else {
                CustomBuilder.showMessage(get_cbuilder_msg("cbuilder.pleaseCorrectErrors"), "danger");
            }
            button.removeAttr("disabled");
        });
    },
    
    /*
     * Check change before close the properties panel
     */
    checkChangeBeforeCloseElementProperties : function(callback) {
        var hasChange = false;
        var isContinue = false;
        
        if (!$("body").hasClass("no-right-panel")) {
            $(".element-properties .property-editor-container").each(function() {
                var editor = $(this).parent().data("editor");
                if (editor !== undefined && !editor.saved && editor.isChange()) {
                    hasChange = true;
                }
            });
        } else {
            isContinue = true;
        }
        
        if (hasChange) {
            if (CustomBuilder.getBuilderSetting("autoApplyChanges")) {
                CustomBuilder.applyElementProperties(function(){
                    if (callback){
                        callback(hasChange);
                    }
                });
            } else {
                isContinue = confirm(get_cbuilder_msg("cbuilder.discardChanges"));
            }
        } else {
            isContinue = true;
        }
        
        if (isContinue && callback) {
            callback(hasChange);
        }
    },
    
    /*
     * Utility method to generate an uuid
     */
    uuid : function(){
        return 'xxxxxxxxxxxx4xxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {  //xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        }).toUpperCase();
    },
    
    /*
     * Generate an unique hash code for a string
     */
    hashCode : function(s) {
        var h = 0, l = s.length, i = 0;
        if ( l > 0 )
          while (i < l)
            h = (h << 5) - h + s.charCodeAt(i++) | 0;
        return h;
    },
    
    /*
     * Show the advanced tools
     */
    enableEnhancedTools : function() {
        $("body").addClass("advanced-tools-supported");
        CustomBuilder.setBuilderSetting("advanceTools", true);
    },
    
    /*
     * Hide the advanced tools
     */
    disableEnhancedTools : function() {
        $("body").removeClass("advanced-tools-supported");
        CustomBuilder.setBuilderSetting("advanceTools", false);
        $("#design-btn").trigger("click");
    },
    
    /*
     * Show/hide builder left panel
     */
    toogleLeftPanel : function() {
        if ($(this).find("i").hasClass("la-angle-left")) {
            $("body").addClass("left-panel-closed");
            $(this).find("i").removeClass("la-angle-left").addClass("la-angle-right");
        } else {
            $("body").removeClass("left-panel-closed");
            $(this).find("i").removeClass("la-angle-right").addClass("la-angle-left");
        }
    },
    
    /*
     * Show/hide builder right panel
     */
    toogleRightPanel : function() {
        if ($(this).find("i").hasClass("la-angle-right")) {
            $("body").addClass("right-panel-closed");
            $(this).find("i").removeClass("la-angle-right").addClass("la-angle-left");
        } else {
            $("body").removeClass("right-panel-closed");
            $(this).find("i").removeClass("la-angle-left").addClass("la-angle-right");
        }
    },
    
    /*
     * Resize builder right panel
     */
    resizeRightPanel : function(event) {
        var button = $(this);
        var panel = $("#right-panel");
        $(panel).addClass("resizing");
        $("body").addClass("right-panel-resizing");
        
        var stopResize = function() {
            $("body").off("mousemove.resize touchmove.resize");
            $("body").off("mouseup.resize touchend.resize");
            
            if ($("body").hasClass("default-builder")) {
                CustomBuilder.Builder.frameHtml.off("mousemove.resize touchmove.resize");
                CustomBuilder.Builder.frameHtml.off("mouseup.resize touchend.resize");
            }
            $(panel).removeClass("resizing");
            $("body").removeClass("right-panel-resizing");
        };
        
        var resize = function(e) {
            var x = e.clientX;
            if (e.originalEvent) {
                x = e.originalEvent.clientX;
            }
            if (e.type === "touchmove") {
                x = e.touches[0].clientX;
                if (e.touches[0].originalEvent) {
                    x= e.touches[0].originalEvent.clientX;
                }
            }
            if (!$(e.currentTarget).is("#cbuilder")) {
                x += $(CustomBuilder.Builder.iframe).offset().left;
            }
            if (x < 60) {
                x = 60;
            }
            var newWidth = $(panel).offset().left - x + $(panel).outerWidth();
            $(panel).css("width", newWidth + "px");
            CustomBuilder.setBuilderSetting("right-panel-width", newWidth);
            
            CustomBuilder.adjustPropertyPanelSize();
        };
        
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.frameHtml.off("mousemove.resize touchmove.resize");
            CustomBuilder.Builder.frameHtml.off("mouseup.resize touchend.resize");
            
            CustomBuilder.Builder.frameHtml.on("mousemove.resize touchmove.resize", resize);
            CustomBuilder.Builder.frameHtml.on("mouseup.resize touchend.resize", stopResize);
        }
        
        $("body").off("mousemove.resize touchmove.resize");
        $("body").off("mouseup.resize touchend.resize");
        
        $("body").on("mousemove.resize touchmove.resize", resize);
        $("body").on("mouseup.resize touchend.resize", stopResize);
    },
    
    /*
     * Animate the builder left panel to reopen it
     */
    animateLeftPanel : function() {
        $("body").removeClass("left-panel-closed");
        $("#left-panel #left-panel-toogle").find("i").removeClass("la-angle-right").addClass("la-angle-left");
            
        $("#left-panel").off('animationend webkitAnimationEnd oAnimationEnd');
        $("#left-panel").on('animationend webkitAnimationEnd oAnimationEnd', function(){
            setTimeout(function(){$("#left-panel").removeClass("switchingLeft");}, 5);
        });
        $("#left-panel").addClass("switchingLeft");
    },
    
    /*
     * Switch builder view based on toolbar icon
     */
    switchView : function() {
        var $this = $(this);
        var view = $this.data("cbuilder-view");
        
        if ($this.is(".active-view")) {
            view = "design";
        }
        
        var currentView = $("[data-cbuilder-view].active-view").data("cbuilder-view");
        if (CustomBuilder.config.builder.callbacks[currentView+"ViewBeforeClosed"] !== undefined) {
            CustomBuilder.callback(CustomBuilder.config.builder.callbacks[currentView+"ViewBeforeClosed"], [$("#"+currentView+"View.builder-view .builder-view-body")]);
        } else if (CustomBuilder[currentView+"ViewBeforeClosed"] !== undefined) {
            CustomBuilder[currentView+"ViewBeforeClosed"]($("#"+currentView+"View.builder-view .builder-view-body"));
        }
        $("body").removeClass(currentView+"-builder-view");
        $("body").removeClass("hide-tool");
        
        $("[data-cbuilder-view]").removeClass("active-view active");
        $(".builder-view").hide();
        
        $("[data-cbuilder-view='"+view+"']").addClass("active-view");
        
        if (view !== "design") {
            var viewDiv = $("#"+view+"View.builder-view");
            if (viewDiv.length === 0) {
                viewDiv = $('<div id="'+view+'View" class="builder-view" style="display:none"><div class="builder-view-header"></div><div class="builder-view-body"></div></div>');
                $("body").append(viewDiv);
            }  
            if (CustomBuilder.config.builder.callbacks[view+"ViewInit"] !== undefined) {
                CustomBuilder.callback(CustomBuilder.config.builder.callbacks[view+"ViewInit"], [$(viewDiv).find('.builder-view-body')]);
            } else if (CustomBuilder[view+"ViewInit"] !== undefined) {
                CustomBuilder[view+"ViewInit"]($(viewDiv).find('.builder-view-body'));
            } else if ($this.attr("href") !== undefined) {
                if ($(viewDiv).find('.builder-view-body iframe').length === 0) {
                    $(viewDiv).find('.builder-view-body').html('<i class="dt-loading las la-spinner la-3x la-spin" style="opacity:0.3; position:absolute; z-index:2000;"></i>');
                    var iframe = document.createElement('iframe');
                    iframe.onload = function() {
                        $(viewDiv).find('.builder-view-body .dt-loading').remove();
                        $(iframe).css('opacity', "1");
                    }; 
                    iframe.src = $this.attr("href"); 
                    $(iframe).css('opacity', "0");
                    $(viewDiv).find('.builder-view-body').append(iframe);
                }
            }
    
            if ($this.data("hide-tool") !== undefined) {
                $("body").addClass("hide-tool");
            }
            
            $("#"+view+"View.builder-view").show();
            $(viewDiv).find('.builder-view-body').trigger("builder-view-show");
            $("body").addClass(view+"-builder-view");
        }
        
        //for builder
        $("#element-highlight-box, #element-select-box").hide();
        $("body").addClass("no-right-panel");
    },
    
    /*
     * Show the builder properties view, called by switchView method
     */
    propertiesViewInit : function(view) {
        $(view).html("");
        
        var props = CustomBuilder.getBuilderProperties();
        
        var options = {
            appPath: CustomBuilder.appPath,
            contextPath: CustomBuilder.contextPath,
            propertiesDefinition : CustomBuilder.propertiesOptions,
            propertyValues : props,
            showCancelButton:false,
            closeAfterSaved : false,
            changeCheckIgnoreUndefined: true,
            autoSave: true,
            saveCallback: CustomBuilder.saveBuilderProperties
        };
        $("body").addClass("stop-scrolling");
        
        $(view).off("builder-view-show");
        $(view).on("builder-view-show", function(){
            $(view).propertyEditor(options);
        });
    },
    
    /*
     * Show the builder preview view, called by switchView method
     */
    previewViewInit : function(view) {
        $(view).html('<div id="preview-iframe-wrapper"><iframe id="preview-iframe" name="preview-iframe" src="about:none"></iframe></div>');
        
        var viewport = $(".responsive-buttons button.active").data("view");
	$(view).closest(".builder-view").addClass(viewport);
        
        var securityToken = ConnectionManager.tokenName + "=" + ConnectionManager.tokenValue;
        $('#cbuilder-preview').attr("action", CustomBuilder.previewUrl + "?" + securityToken);
        $('#cbuilder-preview').attr("target", "preview-iframe");
        $('#cbuilder-preview').submit();
        return false;
    },
    
    /*
     * Show the tree viewer on left panel, called by switchView method
     */
    treeViewerViewInit : function(view) {
        if ($("body").hasClass("default-builder")) {
            $(view).closest(".builder-view").addClass("treeRightPanel");
            $(view).closest(".builder-view").prependTo($("#left-panel")).css("top", "0px");
            CustomBuilder.animateLeftPanel();
            view.addClass("panel-section tree");
            view.html("");
            view.append('<div class="panel-header"><span class="text-secondary">'+get_advtool_msg("adv.tool.Tree.Viewer")+'</span></div><div class="tree-container scrollable tree"></div>');
            
            CustomBuilder.Builder.renderTreeMenu(view.find(".tree-container"));
            
            $(CustomBuilder.Builder.iframe).off("change.builder");
            $(CustomBuilder.Builder.iframe).on("change.builder", function() {
                if ($(view).is(":visible")) {
                    view.find(".tree-container").html("");
                    CustomBuilder.Builder.renderTreeMenu(view.find(".tree-container"));
                }
            });
        }
    },
    
    /*
     * Run before tree viewer view dismiss, called by switchView method
     */
    treeViewerViewBeforeClosed : function(view) {
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.animateLeftPanel();
        }
    },
    
    /*
     * Show the xray view, called by switchView method
     */
    xrayViewInit : function(view) {
        CustomBuilder.treeViewerViewInit(view);
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.renderNodeAdditional('Xray');
        }
    },
    
    /*
     * Run before xray view dismiss, called by switchView method
     */
    xrayViewBeforeClosed : function(view) {
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.removeNodeAdditional();
            CustomBuilder.animateLeftPanel();
        }
    },
    
    /*
     * Show the permission editor view, called by switchView method
     */
    permissionViewInit : function(view) {
        if ($("body").hasClass("default-builder")) {
            view.html("");
            $("body").addClass("disable-select-edit");
            
            view.append('<div class="permission-rules panel-section"><div class="panel-header"><span class="text-secondary">'+get_advtool_msg("adv.permission.rules")+'</span></div><div class="permission-rules-container scrollable"></div></div>');
            
            var ruleObject = CustomBuilder.data.properties;
            if (CustomBuilder.config.builder.callbacks["getRuleObject"] !== undefined && CustomBuilder.config.builder.callbacks["getRuleObject"] !== "") {
                ruleObject = CustomBuilder.callback(CustomBuilder.config.builder.callbacks["getRuleObject"], []);
            }
            
            CustomBuilder.Builder.renderPermissionRules(view.find(".permission-rules"), ruleObject);
            
            var tree = $('<div class="tree-viewer"></div>');
            view.append(tree);
            CustomBuilder.treeViewerViewInit(tree);
        } else {
            $(view).prepend('<i class="dt-loading fas fa-5x fa-spinner fa-spin"></i>');
            PermissionManager.init($(view), $("#cbuilder-info").find('textarea[name="json"]').val(), CustomBuilder.advancedToolsOptions);
            $(view).find(".dt-loading").remove();
            
            $("#cbuilder-info").find('textarea[name="json"]').off("change.permissionView");
            $("#cbuilder-info").find('textarea[name="json"]').on("change.permissionView", function() {
                if (!$(view).is(":visible")) { //ignore if current tab is permission tab
                    $(view).html("");
                }
            });
        }
    },
    
    /*
     * Run before permission editor dismiss, called by switchView method
     */
    permissionViewBeforeClosed : function(view) {
        if ($("body").hasClass("default-builder")) {
            CustomBuilder.Builder.removeNodeAdditional();
            CustomBuilder.animateLeftPanel();
            $("body").removeClass("disable-select-edit");
        }
    },
    
    /*
     * Show the find usage view, called by switchView method
     */
    findUsagesViewInit : function(view) {
        $(view).html("");
        Usages.render($(view), CustomBuilder.id, CustomBuilder.advancedToolsOptions.builder, CustomBuilder.advancedToolsOptions);
    },
    
    /*
     * Show the i18n editor view, called by switchView method
     */
    i18nViewInit : function(view) {
        if ($(view).find(".i18n_table").length === 0) {
            $(view).html("");
            $(view).prepend('<i class="dt-loading las la-spinner la-3x la-spin" style="opacity:0.3"></i>');
            
            var config = $.extend(true, CustomBuilder.config.advanced_tools.i18n.options, CustomBuilder.advancedToolsOptions);
            I18nEditor.init($(view), $("#cbuilder-info").find('textarea[name="json"]').val(), config);
            
            $(view).find(".dt-loading").remove();
            
            $("#cbuilder-info").find('textarea[name="json"]').off("change.i18n");
            $("#cbuilder-info").find('textarea[name="json"]').on("change.i18n", function() {
                $(view).html("");
            });
        }
        setTimeout(function(){
            I18nEditor.refresh($(view));
        }, 5);
    },
    
    /*
     * Show the diff checker view, called by switchView method
     */
    diffCheckerViewInit : function(view) {
        $(view).html('<div id="diffoutput"> </div>');
        
        CustomBuilder.merge(function(){
            var original = $('#cbuilder-json-original').val();
            var current = $('#cbuilder-json').val();
            
            original = difflib.stringAsLines(JSON.stringify(JSON.decode(original), null, 4));
            current = difflib.stringAsLines(JSON.stringify(JSON.decode(current), null, 4));
            
            var sm = new difflib.SequenceMatcher(original, current),
            opcodes = sm.get_opcodes();
            
            if (opcodes.length === 1 && opcodes[0][0] === "equal") {
                $(view).append('<p>'+get_advtool_msg('diff.checker.noChanges')+'</p>');
            } else {
                $("#diffoutput").append(diffview.buildView({
                    baseTextLines: original,
                    newTextLines: current,
                    opcodes: opcodes,
                    baseTextName: "",
                    newTextName: "",
                    contextSize: null,
                    viewType: "1"
                }));
                
                //generate indicator
                var height = $("#diffoutput table").outerHeight() + 75;
                $("#diffoutput").append('<div id="diff-indicator" style="visibility:hidden;" ><canvas id="diff-indicator-canvas" width="10" height="'+(height + 3)+'"></div>');
                var c = document.getElementById("diff-indicator-canvas");
                var ctx = c.getContext("2d");
                $("#diffoutput table tbody tr > td").each(function(index, td){
                    if ($(td).is(".replace, .delete, .insert")) {
                        var cssClass = $(td).attr("class");
                        var y = $(td).offset().top - 65;
                        
                        var color = "#ff3349";
                        if (cssClass === "insert") {
                            color = "#49f772";
                        } else if (cssClass === "replace") {
                            color = "#fdd735";
                        }
                        
                        ctx.beginPath();
                        ctx.rect(0, y, 10, $(td).outerHeight());
                        ctx.fillStyle = color;
                        ctx.fill();
                    }
                });
                var image = c.toDataURL("image/png");
                $("#diff-indicator canvas").remove();
                $("#diff-indicator").css({
                    "visibility" : "",
                    "background-image" : "url("+image+")",
                    "background-repeat" : "repeat-x",
                    "background-size" : "contain"
                });
            }
        });
    },
    
    /*
     * Show the JSON definition view, called by switchView method
     */
    jsonDefViewInit : function(view) {
        if ($(view).find($("#cbuilder-info")).length === 0) {
            $(view).append($("#cbuilder-info"));
            $("#cbuilder-info").show();
            $("#cbuilder-info").prepend('<pre id="json_definition"></pre>');

            var editor = ace.edit("json_definition");
            editor.$blockScrolling = Infinity;
            editor.setTheme("ace/theme/textmate");
            editor.getSession().setTabSize(4);
            editor.getSession().setMode("ace/mode/json");
            editor.setAutoScrollEditorIntoView(true);
            editor.setOption("maxLines", 1000000); //unlimited, to fix the height issue
            editor.setOption("minLines", 10);
            editor.resize();
            var textarea = $("#cbuilder-info").find('textarea[name="json"]').hide();
            $(textarea).on("change", function() {
                if (!CustomBuilder.editorSilentChange) {
                    CustomBuilder.editorSilentChange = true;
                    var jsonObj = JSON.decode($(this).val());
                    editor.getSession().setValue(JSON.stringify(jsonObj, null, 4));
                    editor.resize(true);
                    CustomBuilder.editorSilentChange = false;
                }
            });
            $(textarea).trigger("change");
            editor.getSession().on('change', function(){
                if (!CustomBuilder.editorSilentChange) {
                    CustomBuilder.editorSilentChange = true;
                    var value = editor.getSession().getValue();
                    if (value.length > 0) {
                        var jsonObj = JSON.decode(value);
                        textarea.val(JSON.encode(jsonObj)).trigger("change");
                    }
                    CustomBuilder.editorSilentChange = false;
                }
            });
            $("#cbuilder-info").find("button").addClass("button").wrap('<div class="sticky-buttons">');
            $("#cbuilder-info").find("button").on("click", function() {
                CustomBuilder.editorIsChange = true;
                var text = $(this).text();
                $(this).text(get_advtool_msg('adv.tool.updated'));
                $(this).attr("disabled", true);
                setTimeout(function(){
                    $("#cbuilder-info").find("button").text(text);
                    $("#cbuilder-info").find("button").removeAttr("disabled");
                }, 1000);
            });
            $(view).data("editor", editor);
        } else {
            var editor = $(view).data("editor");
            CustomBuilder.editorIsChange = false;
            editor.resize(true);
        }
    },
    
    /*
     * Run before JSON definition view dismiss, called by switchView method
     */
    jsonDefViewBeforeClosed : function(view) {
        if (!CustomBuilder.editorIsChange) {
            CustomBuilder.editorSilentChange = true;
            $("#cbuilder-info").find('textarea[name="json"]').val(CustomBuilder.getJson());
            CustomBuilder.editorSilentChange = false;
        }
    },
    
    /*
     * Prepare and render the screeshot view, called by switchView method
     */
    screenshotViewInit: function(view) {
        $("body").addClass("no-left-panel");
        $(view).html('<div id="screenshotViewImage"></div><div class="sticky-buttons"></div>');
        
        if ($("body").hasClass("default-builder")) {
            $(CustomBuilder.Builder.iframe).off("change.builder", CustomBuilder.Builder.renderScreenshot);
            $(CustomBuilder.Builder.iframe).on("change.builder", CustomBuilder.Builder.renderScreenshot);

            CustomBuilder.Builder.renderScreenshot();
        }
    },
    
    /*
     * Reset the builder back to design view, called by switchView method
     */
    screenshotViewBeforeClosed: function(view) {
        $("body").removeClass("no-left-panel");
    },
    
    /*
     * Search element in left panel when left panel search field keyup
     */
    tabSearch : function() {
        var searchText = this.value.toLowerCase();
	var tab = $(this).closest(".tab-pane");
	$(tab).find(".components-list li ol li").each(function () {
            var element = $(this);
            element.hide();
            if ($(element).find("a").text().toLowerCase().indexOf(searchText) > -1) { 
                element.show();
            }
	});
        if (this.value !== "") {
            $(this).next("button").show();
        } else {
            $(this).next("button").hide();
        }
    },
    
    /*
     * Clear the search on left panel when clear icon clicked 
     */
    clearTabSearch : function() {
        var tab = $(this).closest(".tab-pane");
        $(tab).find(".component-search").val("");
        $(tab).find(".components-list li ol li").show();
        $(this).hide();
    },
    
    /*
     * Toggle fullscreen mode
     */
    fullscreen : function() {
        if (document.documentElement.requestFullScreen) {

            if (document.FullScreenElement)
                document.exitFullScreen();
            else
                document.documentElement.requestFullScreen();
        //mozilla		
        } else if (document.documentElement.mozRequestFullScreen) {

            if (document.mozFullScreenElement)
                document.mozCancelFullScreen();
            else
                document.documentElement.mozRequestFullScreen();
        //webkit	  
        } else if (document.documentElement.webkitRequestFullScreen) {

            if (document.webkitFullscreenElement)
                document.webkitExitFullscreen();
            else
                document.documentElement.webkitRequestFullScreen();
        //ie	  
        } else if (document.documentElement.msRequestFullscreen) {

            if (document.msFullScreenElement)
                document.msExitFullscreen();
            else
                document.documentElement.msRequestFullscreen();
        }
    },
    
    /*
     * Cheange viewport based on viewport icon pressed
     */
    viewport : function (view) {
        if (typeof view !== "string") {
            view = $(view.target).closest("button").data("view");
        }
        $(".responsive-buttons button").removeClass("active");
        $(".responsive-buttons button#"+view+"-view").addClass("active");
	$("body, #builder_canvas, #previewView").removeClass("mobile tablet desktop").addClass(view);
        
        //for builder
        $("#element-highlight-box, #element-select-box").hide();
        $("body").addClass("no-right-panel");
        
        $("body").trigger($.Event("viewport.change", {"view": view}));
    },
    
    /*
     * adjust the right panel size
     */
    adjustPropertyPanelSize : function () {
        $("body").addClass("max-property-editor");
        
        var width = CustomBuilder.getBuilderSetting("right-panel-width");
        if (!isNaN(width)) {
            var winWidth = $("body").width() - 60;
            if (width > winWidth) {
                width = winWidth;
            }
            $("#right-panel").css("width", width + 'px');
        }
        
        var width = $("#right-panel").width();
        if (width > 450) {
            $("#right-panel .property-editor-container").addClass("wider");
        } else {
            $("#right-panel .property-editor-container").removeClass("wider");
        }
    },
    
    /*
     * Close the right panel
     */
    closePropertiesWindow : function() {
        CustomBuilder.checkChangeBeforeCloseElementProperties(function(){
            $("body").addClass("no-right-panel");
        });
    },
    
    /*
     * Expand all sections in properties panel
     */
    expandAllProperties : function() {
        $("#right-panel .property-editor-container > .property-editor-pages > .property-editor-page ").removeClass("collapsed");
        $("#expand-all-props-btn").hide();
        $("#collapse-all-props-btn").show();
    },
    
    /*
     * Collapse all sections in properties panel
     */
    collapseAllProperties : function() {
        $("#right-panel .property-editor-container > .property-editor-pages > .property-editor-page ").addClass("collapsed");
        $("#expand-all-props-btn").show();
        $("#collapse-all-props-btn").hide();
    },
    
    /*
     * Search property on right panel when search field keyup event
     */
    propertySearch : function() {
        var searchText = this.value.toLowerCase();
	var tab = $(this).closest(".element-properties");
        $(tab).find(".property-page-show").each(function() {
            var page = $(this);
            if ($(page).find(".property-editor-page-title > span").text().toLowerCase().indexOf(searchText) > -1) { 
                $(page).find(".property-editor-property").removeClass("property-search-hide");
            } else {
                $(page).find(".property-editor-property").each(function () {
                    var element = $(this);
                    element.addClass("property-search-hide");
                    if ($(element).find(".property-label").text().toLowerCase().indexOf(searchText) > -1) { 
                       element.removeClass("property-search-hide");
                    }
                });
            }
            
            if ($(page).find(".property-editor-property:not(.property-search-hide)").length > 0) {
                $(page).removeClass("property-search-hide collapsed");
            } else {
                $(page).addClass("property-search-hide");
            }
        });
        if (this.value !== "") {
            $(this).next("button").show();
        } else {
            $(this).next("button").hide();
        }
    },
    
    /*
     * Clear the search on right panel
     */
    clearPropertySearch : function() {
        var tab = $(this).closest(".element-properties");
        $(tab).find(".component-search").val("");
        $(tab).find(".property-search-hide").removeClass("property-search-hide");
        $(this).hide();
    },
    
    /*
     * Toggle the auto apply changes value
     */
    toogleAutoApplyChanges : function() {
        if (CustomBuilder.getBuilderSetting("autoApplyChanges") === true) {
            CustomBuilder.setBuilderSetting("autoApplyChanges", false);
            $("#toggleAutoApplyChange").addClass("toggle-disabled").removeClass("toggle-enabled");
            $("#toggleAutoApplyChange").attr("title", get_cbuilder_msg("cbuilder.enableAutoApplyChanges"));
        } else {
            CustomBuilder.setBuilderSetting("autoApplyChanges", true);
            $("#toggleAutoApplyChange").addClass("toggle-enabled").removeClass("toggle-disabled");
            $("#toggleAutoApplyChange").attr("title", get_cbuilder_msg("cbuilder.disableAutoApplyChanges"));
        }
    },
    
    /*
     * Utility method to get property for an object
     */
    getPropString : function(value) {
        return (value !== undefined && value !== null) ? value : "";
    },
    
    /*
     * Method used for toolbar to copy an element
     */
    copyElement : function() {
        if (CustomBuilder.Builder.selectedEl !== null) {
            CustomBuilder.Builder.copyNode();
        }
    },
    
    /*
     * Method used for toolbar to paste an element
     */
    pasteElement : function() {
        CustomBuilder.Builder.pasteNode();
    },
    
    /*
     * Retrieve permision plugin option for permission editor
     */
    getPermissionOptions: function(){
        return CustomBuilder.permissionOptions;
    },
    
    /*
     * Utility method to cache ajax call, this is for better performance when frquently undo/redo or update element
     */
    cachedAjax: function(ajaxObj) {
        var json = "";
        if (ajaxObj.data !== null && ajaxObj.data !== undefined) {
            json = JSON.encode(ajaxObj.data);
        }
        var key = (ajaxObj.type?ajaxObj.type:"") + "::" + ajaxObj.url + "::" + CustomBuilder.hashCode(json);
        
        if (CustomBuilder.cachedAjaxCalls[key] !== undefined) {
            //cache for 60sec
            if (((new Date().getTime()) - CustomBuilder.cachedAjaxCalls[key].time) < 60000) {
                if (ajaxObj.success) {
                    ajaxObj.success(CustomBuilder.cachedAjaxCalls[key].data);
                }
                return;
            } else {
                delete CustomBuilder.cachedAjaxCalls[key];
            }
        }
        
        var orgSuccess = ajaxObj.success;
        ajaxObj.success = function(response) {
            CustomBuilder.cachedAjaxCalls[key] = {
                time : (new Date().getTime()),
                data : response
            };

            if (orgSuccess) {
                orgSuccess(response);
            }
        };
        
        $.ajax(ajaxObj);
    },
    
    /*
     * Get screenshot of an element
     */
    getScreenshot: function(target, callback, errorCallback) {
        var hasSvg = false;
        if ($(target).find("svg").length > 0) {
            hasSvg = true;
            $(target).find("svg").each(function(i, svg){
                var newsvg = $(svg).clone().wrap('<p>').parent().html();
                var $tempCanvas = $('<canvas class="screenshotSvg"></canvas>');
                $tempCanvas.attr("style", $(svg).attr("style"));
                $(svg).after($tempCanvas);
                // fix duplicate xmlns
                newsvg = newsvg.replace('xmlns="http://www.w3.org/1999/xhtml"', '');
                // render
                canvg($tempCanvas[0], newsvg);
            });
        }
        target = $(target)[0];
        html2canvas(target, {logging : false}).then(canvas => {
            if (hasSvg === true) {
                $(target).find('canvas.screenshotSvg').remove();
            }
            var image = canvas.toDataURL("image/png");
            if (callback) {
                callback(image);
            }
        },
        error => {
            if (hasSvg === true) {
                $(target).find('canvas.screenshotSvg').remove();
            }
            if (errorCallback) {
                callback(error);
            }
        });
    },
    
    /*
     * Utility method to check is there an unsaved changes
     */
    isSaved : function(){
        var hasChange = false;
        
        if ($("body").hasClass("property-editor-right-panel") && !$("body").hasClass("no-right-panel")) {
            $(".element-properties .property-editor-container").each(function() {
                var editor = $(this).parent().data("editor");
                if (editor !== undefined && !editor.saved && editor.isChange()) {
                    hasChange = true;
                }
            });
        }
        
        if($('#cbuilder-json-original').val() === $('#cbuilder-json').val() && !hasChange){
            return true;
        }else{
            return false;
        }
    },
    
    /*
     * Used to retrieve all the builder items in current app
     */
    getBuilderItems : function(callback) {
        if (callback) {
            CustomBuilder.builderItemsLoading.push(callback);
        }
        
        if (CustomBuilder.builderItemsLoading.length === 1) {
            $.ajax({
                type: "GET",
                url: CustomBuilder.contextPath + "/web/json/console/app/"+CustomBuilder.appId+"/"+CustomBuilder.appVersion+"/adminbar/builder/menu",
                dataType: 'json',
                success: function (data) {
                    CustomBuilder.builderItems = data;
                    
                    var callbacks = $.extend([], CustomBuilder.builderItemsLoading);
                    CustomBuilder.builderItemsLoading = [];
                    
                    for (var i in callbacks) {
                        callbacks[i](data);
                    }
                }
            });
        }
    },
    
    /*
     * Render additional menus to adding bar
     */
    intBuilderMenu : function() {
        if ($("#quick-nav-bar").find("#builder-quick-nav").length === 0) {
            $("#quick-nav-bar").append('<div id="closeQuickNav"></div>');
            $("#quick-nav-bar").append('<div id="builder-quick-nav">\
                <div id="builder-menu" style="display: none;">\
                    <div id="builder-menu-search">\
                        <input type="text" placeholder="'+get_cbuilder_msg("cbuilder.search") + '" value="" />\
                        <button class="clear-backspace" style="display:none;"><i class="la la-close"></i></button>\
                    </div><ul></ul>\
                </div></div>');

            $("#builder-menu-search input").off("keyup");
            $("#builder-menu-search input").on("keyup", function(){
                var searchText = $(this).val().toLowerCase();
                $("#builder-menu ul li ul li.item").each(function(){
                    var element = $(this);
                    element.hide();
                    if ($(element).find("a").text().toLowerCase().indexOf(searchText) > -1) { 
                        element.show();
                    }
                });
                if (searchText !== "") {
                    $("#builder-menu-search .clear-backspace").show();
                } else {
                    $("#builder-menu-search .clear-backspace").hide();
                }
            });
            
            $("#closeQuickNav").off("click");
            $("#closeQuickNav").on("click", function(){
                $("#quick-nav-bar").removeClass("active");
            });
            
            $(document).off("keydown.quicknav");
            $(document).on("keydown.quicknav", function(e) {
                // ESCAPE key pressed
                if (e.keyCode === 27) {
                    if ($("#quick-nav-bar").hasClass("active")) {
                        $("#quick-nav-bar").removeClass("active");
                    } else if ($("body").hasClass('property-editor-right-panel') && !$("body").hasClass('no-right-panel')) {
                        CustomBuilder.closePropertiesWindow();
                    }
                }
            });

            $("#builder-menu-search .clear-backspace").off("click");
            $("#builder-menu-search .clear-backspace").on("click", function(){
                $("#builder-menu ul li ul li").show();
                $("#builder-menu-search input").val("");
                $("#builder-menu-search .clear-backspace").hide();
            });
            
            $("#builder-quick-nav").off("click", "li.builder-icon");
            $("#builder-quick-nav").on("click", "li.builder-icon", function(){
                $("#quick-nav-bar").addClass("active");
                return false;
            });

            $("#builder-quick-nav").off("click", "a.launch");
            $("#builder-quick-nav").on("click", "a.launch", function(){
                window.open($(this).attr('href'));
                return false;
            });
            
            $("#builder-quick-nav").off("click", "a.builder-link");
            $("#builder-quick-nav").on("click", "a.builder-link", function(){
                CustomBuilder.ajaxRenderBuilder($(this).attr("href"));
                return false;
            });

            $("#builder-menu ul").off("click", ".addnew a");
            $("#builder-menu ul").on("click", ".addnew a", function(){
                var type = $(this).data("type");
                if (type === "process") {
                    CustomBuilder.ajaxRenderBuilder(CustomBuilder.contextPath + '/web/console/app' + CustomBuilder.appPath + '/process/builder');
                } else {
                    var url = CustomBuilder.contextPath + '/web/console/app' + CustomBuilder.appPath + '/';
                    if (type === "form" || type === "datalist" || type === "userview") {
                        url += type + '/create?builderMode=true';
                    } else {
                        url += "cbuilder/" + type + "/create?builderMode=false";
                    }
                    JPopup.show("navCreateNewDialog", url, {}, "");
                }
                return false;
            });
        }
        $("#quick-nav-bar").removeClass("active");
        
        setTimeout(function(){
            CustomBuilder.reloadBuilderMenu();
        }, 100); //delay the loading to prevent it block the builder ajax call
    },
    
    reloadBuilderMenu : function() {
        CustomBuilder.getBuilderItems(CustomBuilder.renderBuilderMenu);
    },
    
    renderBuilderMenu : function(data) {
        $("#builder-menu > ul").html("");
        
        var container = $("#builder-menu > ul");
        
        $("#builder-quick-nav .backToApp").remove();
        $("#builder-quick-nav").prepend('<div class="backToApp"><a class="builder-link" href="'+CustomBuilder.contextPath+'/web/console/app'+CustomBuilder.appPath+'/builders"  target="_self" title="'+get_cbuilder_msg("abuilder.title")+'"><i class="far fa-edit"></i></a></div>');
        
        for (var i in data) {
            var builder = data[i];
            var li = $('<li class="builder-icon menu-'+builder.value+'"><span tooltip-position="right" title="'+builder.label+'" style="background: '+builder.color+';color: '+builder.color+'"><i class="'+builder.icon+'"></i></span><ul></ul></li>');
            $(li).find("ul").append('<li class="header"><span class="header-label">'+builder.label+'</span> <span class="addnew"><a data-type="'+builder.value+'"><i class="las la-plus-circle"></i> '+get_cbuilder_msg("cbuilder.addnew")+'</a></span></li>');
            if (builder.elements) {
                for (var j in builder.elements) {
                    var extra = '';
                    if (builder.value === "userview" && CustomBuilder.appPublished === "true") {
                        extra = '<a class="launch" title="'+get_cbuilder_msg('ubuilder.launch')+'" href="'+CustomBuilder.contextPath+'/web/userview/'+CustomBuilder.appId+'/'+builder.elements[j].id+'" target="_blank"><i class="fas fa-play"></i></a>';
                    }
                    $(li).find("ul").append('<li class="item" data-id="'+builder.elements[j].id+'" ><a class="builder-link" href="'+builder.elements[j].url+'" target="_self">'+builder.elements[j].label+'</a>'+extra+'</li>');
                }
            }
            container.append(li);
        }

        $("#builder-menu > ul > li.menu-" + CustomBuilder.builderType).addClass("active");

        $("#builder-menu > ul > li.builder-icon").off("click touch");
        $("#builder-menu > ul > li.builder-icon").on("click touch", function(){
            $("#builder-menu > ul > li.builder-icon").removeClass("active");
            $(this).addClass("active");
        });
        
        $("body").addClass("quick-nav-shown");
    },
    
    /*
     * Store previous Presence Indicator and start with new url
     */
    updatePresenceIndicator : function() {
        if (PresenceUtil.source !== null) {
            PresenceUtil.source.close();
            PresenceUtil.source = null;
        }
        PresenceUtil.createEventSource();
    }
};

/*
 * Default builder to manage the palette and canvas
 */
_CustomBuilder.Builder = {
    zoom : 1,
    dragMoveMutation : false,
    mousedown : false,
    defaultOptions : {
        "enableViewport" : true,
        "enableCopyPaste" : true,
        callbacks : {
            "initComponent" : "",
            "renderElement" : "",
            "selectElement" : "",
            "updateElementId" : "",
            "unloadElement" : ""
        }
    },
    options : {},
    
    /*
     * A stating point to use the default builder
     */
    init : function(options, callback) {
        CustomBuilder.Builder.options = $.extend(true, {}, CustomBuilder.Builder.defaultOptions);
        CustomBuilder.Builder.options = $.extend(true, CustomBuilder.Builder.options, options);
        
        if (CustomBuilder.Builder.options.enableViewport) {
            $("#top-panel .responsive-buttons").show();
            $("body").addClass("viewport-enabled");
            CustomBuilder.viewport("desktop");
        } else {
            $("#top-panel .responsive-buttons").hide();
        }
        
        if (CustomBuilder.Builder.options.enableCopyPaste) {
            $("#builderToolbar .copypaste").show();
            
            if (!(typeof document.addEventListener === "undefined")) {
                var hidden, visibilityChange;
                if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
                    hidden = "hidden";
                    visibilityChange = "visibilitychange";
                } else if (typeof document.msHidden !== "undefined") {
                    hidden = "msHidden";
                    visibilityChange = "msvisibilitychange";
                } else if (typeof document.webkitHidden !== "undefined") {
                    hidden = "webkitHidden";
                    visibilityChange = "webkitvisibilitychange";
                }

                document.addEventListener(visibilityChange, function(){
                    if (!document[hidden]) {
                        var element = self.selectedEl;
                        var data = CustomBuilder.data;
                        if (element !== null) {
                            data = $(element).data("data");
                        }
                        var component = self.parseDataToComponent(data);
                        if (component !== null && component.builderTemplate.isPastable(data, component)) {
                            $("#paste-element-btn").removeClass("disabled");
                        }
                    }
                }, false);
            }
        } else {
            $("#builderToolbar .copypaste").hide();
        }
        
        var self = this;
        self.selectedEl = null;
	self.highlightEl = null;
        self.zoom = 1;
                
        $("#builder_canvas").append('<div id="iframe-wrapper"> \
                <div id="iframe-layer"> \
                    <div id="element-highlight-box"> \
                        <div id="element-highlight-name"></div> \
                    </div> \
                    <div id="element-select-box"> \
                        <div id="element-select-name"><div id="element-name"></div> \
                            <div id="element-actions">   \
                                <a id="parent-btn" href="" title="'+get_cbuilder_msg("cbuilder.selectParent")+'"><i class="las la-level-up-alt"></i></a> \
                                <a id="up-btn" href="" title="'+get_cbuilder_msg("cbuilder.moveUp")+'"><i class="la la-arrow-up"></i></a> \
                                <a id="down-btn" href="" title="'+get_cbuilder_msg("cbuilder.moveDown")+'"><i class="la la-arrow-down"></i></a> \
                                <a id="left-btn" href="" title="'+get_cbuilder_msg("cbuilder.moveLeft")+'"><i class="la la-arrow-left"></i></a> \
                                <a id="right-btn" href="" title="'+get_cbuilder_msg("cbuilder.moveRight")+'"><i class="la la-arrow-right"></i></a> \
                                <span id="element-options"> \
                                    \
                                </span>   \
                                <a id="delete-btn" href="" title="'+get_cbuilder_msg("cbuilder.remove")+'"><i class="la la-trash"></i></a> \
                            </div> \
                        </div> \
                        <div id="element-bottom-actions">   \
                        </div> \
                    </div> \
                </div> \
                <iframe src="about:none" id="iframe1"></iframe> \
            </div>');
        
        $("#style-properties-tab-link").show();
        
        self.documentFrame = $("#iframe-wrapper > iframe");
        self.canvas = $("#builder_canvas");
        
        $("body").addClass("default-builder");
        
        self._loadIframe(CustomBuilder.contextPath+'/builder/blank.jsp', callback);
        
        self._initDragdrop();
        self._initBox();
        self._initPermissionComponent();
        
        self.dragElement = null;
    },
    
    /*
     * Reset to initial state
     */
    reset: function() {
        var self = CustomBuilder.Builder;
        self.unbindEvent("change.builder");
        self.unbindEvent("nodeAdditionalSelected nodeAdditionalAdded nodeAdditionalRemoved nodeAdditionalModeChanged");
        $("body").removeClass("default-builder");
        $("body").removeClass("viewport-enabled");
    },
    
    /*
     * Render the json to canvas
     */
    load: function(data, callback) {
        CustomBuilder.Builder.frameBody.addClass("initializing");
        
        var self = CustomBuilder.Builder;
        
        var selectedELSelector = "";
        var selectedElIndex = 0;
        if (self.selectedEl) {
            if ($(self.selectedEl).is("[data-cbuilder-id]")) {
                selectedELSelector = '[data-cbuilder-id="'+ $(self.selectedEl).data("cbuilder-id") +'"]';
            } else {
                selectedELSelector = '[data-cbuilder-id="'+ $(self.selectedEl).closest('[data-cbuilder-id]').data("cbuilder-id") +'"]';
                selectedELSelector += ' [data-cbuilder-classname="' + $(self.selectedEl).data("cbuilder-classname") + '"]';
            }
            
            selectedElIndex = self.frameBody.find(selectedELSelector).index(self.selectedEl);
        } 
        
        self.frameBody.html("");
        self.selectNode(false);
        $("#element-highlight-box").hide();
        
        var component = self.parseDataToComponent(data);
        var temp = $('<div></div>');
        self.frameBody.append(temp);
        self.renderElement(data, temp, component, false, null, function(){
            if (self.nodeAdditionalType !== undefined && self.nodeAdditionalType !== "") {
                CustomBuilder.Builder.renderNodeAdditional(self.nodeAdditionalType);
            }
            
            //reselect previous selected element
            if (selectedELSelector !== "") {
                var element = self.frameBody.find(selectedELSelector);
                if (element.length > 1) {
                    do {
                        element = element[selectedElIndex];
                    } while (element === undefined && selectedElIndex-- > 0);
                }
                if ($(element).length > 0) {
                    self.selectNode(element);
                }
            }
            
            if (callback) {
                callback();
            }
            
            setTimeout(function(){
                CustomBuilder.Builder.frameBody.removeClass("initializing");
            }, 1);
        });
        
        if (component !== null && component.builderTemplate.isPastable(data, component)) {
            $("#paste-element-btn").removeClass("disabled");
        }
        
        $("#iframe-wrapper").show();
    },
    
    /*
     * Used to decide what builder component use for the element data
     */
    parseDataToComponent : function(data) {
        var self = CustomBuilder.Builder;
        
        var component = null;
        if (data !== undefined && data.className !== undefined) {
            component = self.getComponent(data.className);
        } else if (self.options.callbacks['parseDataToComponent'] !== undefined && self.options.callbacks['parseDataToComponent'] !== "") {
            component = CustomBuilder.callback(self.options.callbacks['parseDataToComponent'], [data]);
        }
        
        return component;
    },
    
    /*
     * Find the child elements of the element data
     */
    parseDataChildElements : function(data, component) {
        var self = CustomBuilder.Builder;
        
        if (data[component.builderTemplate.getChildsDataHolder(data, component)] !== undefined) {
            return data[component.builderTemplate.getChildsDataHolder(data, component)];
        } else if (self.options.callbacks['parseDataChildElements'] !== undefined && self.options.callbacks['parseDataChildElements'] !== "") {
            return CustomBuilder.callback(self.options.callbacks['parseDataChildElements'], [data]);
        }
        return null;
    },
    
    /*
     * Find the properties of the element data
     */
    parseElementProps : function(data) {
        if (data.properties !== undefined) {
            return data.properties;
        } else {
            return data;
        }
    },
    
    /*
     * Load/update/re-rendering child elements of the element data
     */
    loadAndUpdateChildElements: function(element, elementObj, component, deferreds) {
        var self = CustomBuilder.Builder;
        var elements = self.parseDataChildElements(elementObj, component);
        
        if (elements !== null && elements.length > 0) {
            var container = $(element);
            if (!$(element).is('[data-cbuilder-'+component.builderTemplate.getChildsContainerAttr(elementObj, component)+']')) {
                container = $(element).find('[data-cbuilder-'+component.builderTemplate.getChildsContainerAttr(elementObj, component)+']:eq(0)');
            }
            
            if ($(container).find("[data-cbuilder-classname]").length === 0) {  //empty container, just load it
                for (var i in elements) {
                    var childComponent = self.parseDataToComponent(elements[i]);
                    var temp = $('<div></div>');
                    $(container).append(temp);
                    
                    var select = false;
                    
                    self.renderElement(elements[i], temp, childComponent, select, deferreds);
                }
            } else { //compare and update
                var i = 0;
                $(container).find("> [data-cbuilder-classname]").each(function() {
                    var data = $(this).data("data");
                    var classname = $(this).data("cbuilder-classname");
                    var childComponent = self.parseDataToComponent(elements[i]);
                    var props = self.parseElementProps(elements[i]);
                    if ((data === undefined || data === null) && classname === childComponent.className) {
                        $(this).data("data", elements[i]);
                        
                        var id = props.id;
                        if (id === undefined && elements[i].id !== undefined) {
                            id = elements[i].id;
                        }
                        
                        $(this).attr("data-cbuilder-id", id);
                        
                        self.loadAndUpdateChildElements($(this), elements[i], childComponent, deferreds);
                    } else {
                        //TODO: if differrent, need add it?
                    }
                    
                    if ($(this).outerHeight(true) === 0) {
                        $(this).attr("data-cbuilder-invisible", "");
                    }
                    i++;
                });
            }
        }
    },
    
    /*
     * Prepare the iframe for canvas
     */
    _loadIframe: function (url, callback) {
        var self = this;
        self.iframe = this.documentFrame.get(0);
        self.iframe.src = url;

        return this.documentFrame.on("load", function ()
        {
            window.FrameWindow = self.iframe.contentWindow;
            window.FrameDocument = self.iframe.contentWindow.document;
            $("#element-highlight-box").hide();

            $(window.FrameWindow).off("scroll resize");
            $(window.FrameWindow).on("scroll resize", function (event) {
                self._updateBoxes();
            });

            return self._frameLoaded(callback);
        });
    },
    
    /*
     * Update the position of the highlight and select box
     */
    _updateBoxes : function() {
        var self = this;
        if (self.selectedEl)
        {
            var node = self.selectedEl;
            if (!self.selectedEl.is(":visible") || self.selectedEl.is("[data-cbuilder-uneditable]")) {
                var id = $(node).data('cbuilder-id');
                if (self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').length > 0) {
                    node = self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').first();
                }
            }
            var box = self.getBox(node);

            $("#element-select-box").css(
                {"top": box.top - self.frameDoc.scrollTop(),
                    "left": box.left - self.frameDoc.scrollLeft(),
                    "width": box.width,
                    "height": box.height,
                    "display" : "block"
                });
        }

        if (self.highlightEl)
        {
            var node = self.highlightEl;
            if (!self.highlightEl.is(":visible") || self.highlightEl.is("[data-cbuilder-uneditable]")) {
                var id = $(node).data('cbuilder-id');
                if (self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').length > 0) {
                    node = self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').first();
                }
            }
            var box = self.getBox(node);

            $("#element-highlight-box").css(
                {"top": box.top - self.frameDoc.scrollTop(),
                    "left": box.left - self.frameDoc.scrollLeft(),
                    "width": box.width,
                    "height": box.height,
                    "display" : "block"
                });
        }
    },
    
    /*
     * Used to initialize the canvas iframe once it is  loaded
     */
    _frameLoaded : function(callback) {
		
        var self = CustomBuilder.Builder;

        self.frameDoc = $(window.FrameDocument);
        self.frameHtml = $(window.FrameDocument).find("html");
        self.frameBody = $(window.FrameDocument).find("body");
        self.frameHead = $(window.FrameDocument).find("head");

        //insert editor helpers like non editable areas
        self.frameHead.append('<link data-cbuilder-helpers href="' + CustomBuilder.contextPath + '/builder/editor-helpers.css" rel="stylesheet">');

        self._initHighlight();

        $(window).triggerHandler("cbuilder.iframe.loaded", self.frameDoc);
        
        if (callback)
            callback();
    },	
    
    /*
     * Used to get the element label of the highlight and select box
     */
    _getElementType: function (data, component) {
        var label = null;
        
        if (component.builderTemplate.getLabel) {
            label = component.builderTemplate.getLabel(data, component);
        }
        
        if (label === null || label === undefined || label === "") {
            label = component.label;
        }
        
        return label;
    },
    
    /*
     * Move the selected element up
     */
    moveNodeUp: function (node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var elementObj = $(node).data("data");
        var component = self.parseDataToComponent(elementObj);
        
        var prev = $(node).prev("[data-cbuilder-classname]");
        if (prev.length > 0) {
            var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            if (parentDataArray === undefined) {
                parentDataArray = [];
                $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
            }
            var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
            if (oldIndex !== -1) {
                parentDataArray.splice(oldIndex, 1);
            }
            
            $(prev).before(node);
            var newIndex = $.inArray($(prev).data("data"), parentDataArray);
            parentDataArray.splice(newIndex, 0, $(self.selectedEl).data("data"));
        } else {
            var parentArr = self.frameHtml.find('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']');
            var index = parentArr.index($(node).closest('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']'));
            if (index > 0) {
                var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
                if (parent.length === 0) {
                    parent = self.selectedEl.closest("body");
                }
                var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                if (parentDataArray === undefined) {
                    parentDataArray = [];
                    $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
                }
                var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
                if (oldIndex !== -1) {
                    parentDataArray.splice(oldIndex, 1);
                }
                
                var newParent = $(parentArr[index - 1]).closest("[data-cbuilder-classname]");
                $(parentArr[index - 1]).append(node);
                parentDataArray = $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                if (parentDataArray === undefined) {
                    parentDataArray = [];
                    $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
                }
                parentDataArray.push($(self.selectedEl).data("data"));
                
                self.checkVisible(parent);
                self.checkVisible(newParent);
            }
        }
        if (component.builderTemplate.afterMoved)
            component.builderTemplate.afterMoved(self.selectedEl, elementObj, component);
        
        if (self.subSelectedEl) {
            self.selectNodeAndShowProperties(self.subSelectedEl, false, (!$("body").hasClass("no-right-panel")));
        } else {
            self.selectNodeAndShowProperties(self.selectedEl, false, (!$("body").hasClass("no-right-panel")));
        }

        CustomBuilder.update();
        self.triggerChange();
    },
    
    /*
     * Move the selected element down
     */
    moveNodeDown: function (node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var elementObj = $(node).data("data");
        var component = self.parseDataToComponent(elementObj);
        
        var next = $(node).next("[data-cbuilder-classname]");
        if (next.length > 0) {
            var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            if (parentDataArray === undefined) {
                parentDataArray = [];
                $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
            }
            var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
            if (oldIndex !== -1) {
                parentDataArray.splice(oldIndex, 1);
            }
            
            $(next).after(node);
            var newIndex = $.inArray($(next).data("data"), parentDataArray) + 1;
            parentDataArray.splice(newIndex, 0, $(self.selectedEl).data("data"));
        } else {
            var parentArr = self.frameHtml.find('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']');
            var index = parentArr.index($(node).closest('[data-cbuilder-'+component.builderTemplate.getParentContainerAttr(elementObj, component)+']'));
            if (index < parentArr.length - 1) {
                var parent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
                if (parent.length === 0) {
                    parent = self.selectedEl.closest("body");
                }
                var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                if (parentDataArray === undefined) {
                    parentDataArray = [];
                    $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
                }
                var oldIndex = $.inArray($(self.selectedEl).data("data"), parentDataArray);
                if (oldIndex !== -1) {
                    parentDataArray.splice(oldIndex, 1);
                }
                
                var newParent = $(parentArr[index + 1]).closest("[data-cbuilder-classname]");
                $(parentArr[index + 1]).find('[data-cbuilder-classname]:eq(0)').before(node);
                parentDataArray = $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
                if (parentDataArray === undefined) {
                    parentDataArray = [];
                    $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
                }
                parentDataArray.splice(0, 0, $(self.selectedEl).data("data"));
                
                self.checkVisible(parent);
                self.checkVisible(newParent);
            }
        }
        if (component.builderTemplate.afterMoved)
            component.builderTemplate.afterMoved(self.selectedEl, elementObj, component);
        
        if (self.subSelectedEl) {
            self.selectNodeAndShowProperties(self.subSelectedEl, false, (!$("body").hasClass("no-right-panel")));
        } else {
            self.selectNodeAndShowProperties(self.selectedEl, false, (!$("body").hasClass("no-right-panel")));
        }

        CustomBuilder.update();
        self.triggerChange();
    },
    
    /*
     * Copy the selected element and paste a clone element after it
     */
    cloneNode:  function(node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var elementObj = $.extend(true, {}, $(node).data("data"));
        self.component = self.parseDataToComponent(elementObj);
        
        self.updateElementId(elementObj);
        
        var parent = $(node).parent().closest("[data-cbuilder-classname]");
        if ($(parent).length === 0) {
            parent = $(node).closest("body");
        }
        var parentDataArray = $(parent).data("data")[self.component.builderTemplate.getParentDataHolder(elementObj, self.component)];
        if (parentDataArray === undefined) {
            parentDataArray = [];
            $(parent).data("data")[self.component.builderTemplate.getParentDataHolder(elementObj, self.component)] = parentDataArray;
        }
        var newIndex = $.inArray($(node).data("data"), parentDataArray) + 1;
        parentDataArray.splice(newIndex, 0, elementObj);
        
        var temp = $('<div></div>');
        $(node).after(temp);
        
        self.renderElement(elementObj, temp, self.component, true);
        
        CustomBuilder.update();
    },
    
    /*
     * Copy the selected element and save in cache
     */
    copyNode: function(node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
        }
        
        var data = $(node).data("data");
        var component = self.parseDataToComponent(data);
        
        CustomBuilder.copy(data, component.builderTemplate.getParentContainerAttr(data, component));
        
        self.selectNode(self.selectedEl);
        
        if (component.builderTemplate.isPastable(data, component)) {
            $("#paste-element-btn").removeClass("disabled");
        }
    },
    
    /*
     * Paste the copied element in cache. 
     * First check the copied element can place as children of the selected element,
     * else check can the copied element can place as sibling of the selected element
     */
    pasteNode: function(node) {
        var self = CustomBuilder.Builder;
        
        if (!node) {
            node = self.selectedEl;
            if (!node) {
                node = self.frameBody.find('[data-cbuilder-classname]:eq(0)');
            }
        }
        
        self.component = self.parseDataToComponent($(node).data("data"));
        
        var data = CustomBuilder.getCopiedElement();
        var copiedObj = $.extend(true, {}, data.object);
        var copiedComponent = self.parseDataToComponent(copiedObj);
        
        self.updateElementId(copiedObj);
        
        if (copiedComponent.builderTemplate.isAbsolutePosition(copiedObj, copiedComponent)) {
            copiedObj.x_offset = parseInt(copiedObj.x_offset) + 5;
            copiedObj.y_offset = parseInt(copiedObj.y_offset) + 5;
        }
        
        if (copiedComponent.builderTemplate.customPasteData) {
            copiedComponent.builderTemplate.customPasteData(copiedObj, copiedComponent);
        }

        if (CustomBuilder.Builder.options.callbacks["pasteElement"] !== undefined && CustomBuilder.Builder.options.callbacks["pasteElement"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["pasteElement"], [node, $(node).data("data"), self.component, copiedObj, copiedComponent]);
        } else {
            self._pasteNode(node, copiedObj, copiedComponent);
        }
        
        CustomBuilder.update();
    },
    
    /*
     * Internal method to handle paste element
     */
    _pasteNode: function(element, copiedObj, copiedComponent) {
        var self = CustomBuilder.Builder;   
        
        var elementObj = $(element).data("data");
        var component = self.parseDataToComponent(elementObj);
        
        var temp = $(copiedComponent.builderTemplate.getPasteTemporaryNode(copiedObj, copiedComponent));
        
        var copiedParentContainerAttr = copiedComponent.builderTemplate.getParentContainerAttr(copiedObj, copiedComponent);
        if (component.builderTemplate.getParentDataHolder(elementObj, component) === copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)
                && component.builderTemplate.getParentContainerAttr(elementObj, component) === copiedParentContainerAttr
                && !($(element).is("[data-cbuilder-"+copiedParentContainerAttr+"]") || $(element).find("[data-cbuilder-"+copiedParentContainerAttr+"]:eq(0)").length > 0)) {
            //paste as sibling
            var parent = $(element).parent().closest("[data-cbuilder-classname]");
            if ($(parent).length === 0) {
                parent = $(element).closest("body");
            }
            var parentDataArray = $(parent).data("data")[copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)];
            if (parentDataArray === undefined) {
                parentDataArray = [];
                $(parent).data("data")[copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)] = parentDataArray;
            }
            var newIndex = $.inArray(elementObj, parentDataArray) + 1;
            parentDataArray.splice(newIndex, 0, copiedObj);

            $(element).after(temp);
        } else {
            //paste as child
            var parentDataArray = $(element).data("data")[copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)];
            if (parentDataArray === undefined) {
                parentDataArray = [];
                $(element).data("data")[copiedComponent.builderTemplate.getParentDataHolder(copiedObj, copiedComponent)] = parentDataArray;
            }
            parentDataArray.push(copiedObj);
            
            var container = null;
            if ($(element).is("[data-cbuilder-"+copiedParentContainerAttr+"]")) {
                container = $(element);
            } else {
                container = $(element).find("[data-cbuilder-"+copiedParentContainerAttr+"]:eq(0)");
            }
            
            if (container.length > 0) {
                $(container).append(temp);
            }
        }
        
        self.component = copiedComponent;
        self.renderElement(copiedObj, temp, copiedComponent, true);
    },
    
    /*
     * Delete a selected node
     */
    deleteNode: function(node) {
        var self = CustomBuilder.Builder;
        
        if (node === undefined) {
            node = $(self.selectedEl);
        }
    
        $("#element-select-box").hide();
        var elementObj = $(node).data("data");
        var component = self.parseDataToComponent(elementObj);

        var parent = $(node).parent().closest("[data-cbuilder-classname]");
        if (parent.length === 0) {
            parent = $(node).closest("body");
        }
        var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
        if (parentDataArray === undefined) {
            parentDataArray = [];
            $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
        }
        var index = $.inArray($(node).data("data"), parentDataArray);
        if (index !== -1) {
            parentDataArray.splice(index, 1);
        }


        if (component.builderTemplate.unload)
            component.builderTemplate.unload($(node), elementObj, component);

        $(node).remove();
        self.selectNode(false);

        if (component.builderTemplate.afterRemoved)
            component.builderTemplate.afterRemoved(parent, elementObj, component);

        self.checkVisible(parent);

        CustomBuilder.update();
        self.triggerChange();
    },
    
    /*
     * Select an element in canvas
     */
    selectNode:  function(node, dragging) {
        CustomBuilder.Builder.selectNodeAndShowProperties(node, dragging, true);
    },
    
    selectNodeAndShowProperties: function(node, dragging, show = true) {
        
        var self = CustomBuilder.Builder;
        if (!node || $(node).is('[data-cbuilder-uneditable]'))
        {
            self.selectedEl = null;
            self.subSelectedEl = null;
            $("#element-select-box").hide();
            
            if ($("body").hasClass("property-editor-right-panel")) {
                $("body").addClass("no-right-panel");
                $("#right-panel .property-editor-container").remove();
                $("#copy-element-btn").addClass("disabled");
            }
                
            return;
        }

//        if (self.texteditEl && self.selectedEl.get(0) != node)
//        {
//            Vvveb.WysiwygEditor.destroy(self.texteditEl);
//            $("#select-box").removeClass("text-edit").find("#select-actions").show();
//            self.texteditEl = null;
//        }

        var target = $(node);
        var isSubSelect = false;
        if ($(node).is('[data-cbuilder-subelement]')) {
            target = $(node).parent().closest("[data-cbuilder-classname]");
        }
        if ($(node).is('[data-cbuilder-select]')) {
            var id = $(node).data('cbuilder-select');
            target = self.frameBody.find('[data-cbuilder-id="'+id+'"]');
            self.subSelectedEl = $(node);
            isSubSelect = true;
        }
        if (!target.is(":visible")) {
            var id = $(node).data('cbuilder-id');
            if (self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible').length > 0) {
                node = self.frameBody.find('[data-cbuilder-select="'+id+'"]:visible');
            }
        }
        if (target)
        {
            if (self.frameBody.hasClass("show-node-details-single")) {
                self.frameBody.find(".cbuilder-node-details.current").removeClass("current");
                $(target).find("> .cbuilder-node-details").addClass("current");
                self.adjustNodeAdditional(target);
                self.triggerEvent("nodeAdditionalSelected");
            }
            
            self.selectedEl = target;
            var data = target.data("data");
            self.selectedElData = data;
            var component = self.parseDataToComponent(data);
            self.component = component;
            
            if (dragging) {
                return;
            }
            if (component === null || component.builderTemplate === undefined) {
                self.component = undefined;
                return;
            }
            
            try {
                var box = self.getBox(node);

                $("#element-select-box").css(
                    {
                        "top": box.top - self.frameDoc.scrollTop(),
                        "left": box.left - self.frameDoc.scrollLeft(),
                        "width": box.width,
                        "height": box.height,
                        "display": "block"
                    });
                
                if (!isSubSelect || (isSubSelect && component.builderTemplate.isSubSelectAllowActions(data, component))) {
                    $("#paste-element-btn").addClass("disabled");
                    if (component.builderTemplate.isPastable(data, component)) {
                        $("#paste-element-btn").removeClass("disabled");
                    }
                    
                    $("#up-btn, #down-btn, #left-btn, #right-btn").hide();
                    if (component.builderTemplate.isMovable(data, component)) {
                        if ((!isSubSelect && $(self.selectedEl).closest('[data-cbuilder-sort-horizontal]').length > 0) || (isSubSelect && $(self.subSelectedEl).closest('[data-cbuilder-alternative-drop]').is('[data-cbuilder-sort-horizontal]'))) {
                            $("#left-btn, #right-btn").show();
                        } else {
                            $("#up-btn, #down-btn").show();
                        }
                    }

                    $("#delete-btn").hide();
                    if (component.builderTemplate.isDeletable(data, component)) {
                        $("#delete-btn").show();
                    }

                    $("#copy-element-btn").addClass("disabled");
                    if (component.builderTemplate.isCopyable(data, component)) {
                        $("#copy-element-btn").removeClass("disabled");
                    }

                    $("#parent-btn").hide();
                    if (component.builderTemplate.isNavigable(data, component)) {
                        $("#parent-btn").show();
                    }
                    $("#element-select-box #element-actions").show();
                } else {
                    $("#element-select-box #element-actions").hide();
                }
                
                if (show) {
                    self._showPropertiesPanel(target, data, component);
                }
                
                $("#element-select-name #element-name").html(this._getElementType(data, component));
                
                $("#element-select-box #element-options").html("");
                $("#element-select-box #element-bottom-actions").html("");
                
                if (component.builderTemplate.selectNode)
                    component.builderTemplate.selectNode(target, data, component);
                
                var offset = $("#element-select-box #element-select-name").offset();
                if (offset.top <= 55) {
                    $("#element-select-box #element-select-name").css("top", "0px");
                } else {
                    $("#element-select-box #element-select-name").css("top", "");
                }
                var right = offset.left + $("#element-select-box #element-select-name").width();
                var frameRight = $("#iframe-wrapper").offset().left + $("#iframe-wrapper").width();
                if (right > frameRight) {
                    $("#element-select-box #element-select-name").css("right", ($("#element-select-box #element-select-name").width() - box.width) + "px");
                    $("#element-select-box #element-select-name").css("left", "unset");
                } else {
                    $("#element-select-box #element-select-name").css("right", "unset");
                    $("#element-select-box #element-select-name").css("left", "-1px");
                }
                
                $("#element-highlight-box").hide();
                self.highlightEl = null;
                
                self.selectedEl.trigger("builder.selected");
            } catch (err) {
                console.log(err);
                return false;
            }
        }
    },
    
    /*
     * show the Properties Panel of a node
     */
    _showPropertiesPanel : function(target, data, component) {
        var self = CustomBuilder.Builder;
        
        if ($("body").hasClass("property-editor-right-panel") && !$("body").hasClass("disable-select-edit")) {
            var supportProps = component.builderTemplate.isSupportProperties(data, component);
            var supportStyle = component.builderTemplate.isSupportStyle(data, component);

            if (supportProps || supportStyle) {
                $("body").removeClass("no-right-panel");

                var elementPropertiesHidden = false;

                if (supportProps) {
                    var props = self.parseElementProps(data);
                    var className = data.className;
                    if (className === undefined) {
                        className = self.selectedEl.data("cbuilder-classname");
                    }
                    if (component.builderTemplate.customPropertiesData) {
                        props = component.builderTemplate.customPropertiesData(props, data, component);
                    }
                    CustomBuilder.editProperties(className, props, data, target);
                } else {
                    elementPropertiesHidden = true;
                    $("#element-properties-tab-link").hide();
                    $("#right-panel #element-properties-tab").find(".property-editor-container").remove();
                }

                if (supportStyle) {
                    var props = self.parseElementProps(data);
                    var className = data.className;
                    if (className === undefined) {
                        className = self.selectedEl.data("cbuilder-classname");
                    }
                    if (component.builderTemplate.customPropertiesData) {
                        props = component.builderTemplate.customPropertiesData(props, data, component);
                    }

                    self.editStyles(props, target, data, component);
                } else {
                    $("#style-properties-tab-link").hide();
                    $("#right-panel #style-properties-tab").find(".property-editor-container").remove();
                }

                if (elementPropertiesHidden) {
                    $("#style-properties-tab-link a").trigger("click");
                } else if (!supportStyle) {
                    $("#element-properties-tab-link a").trigger("click");
                }
            } else {
                $("body").addClass("no-right-panel");
            }
        }
    },
    
    /*
     * Init the canvas highlight event
     * It handle the drag and drop moving as well
     */
    _initHighlight: function () {

        var self = CustomBuilder.Builder;

        self.frameHtml.off("mousemove touchmove");
        self.frameHtml.on("mousemove touchmove", function (event, parentEvent) {
            var x = 0;
            var y = 0;
            
            var eventTarget = $(event.target);
            if (event.type === "touchmove") {
                if (event.touches === undefined) {
                    var frameOffset = $(self.iframe).offset();
                    x = parentEvent.touches[0].clientX;
                    y = parentEvent.touches[0].clientY;
                    if (parentEvent.touches[0].originalEvent) {
                        x = parentEvent.touches[0].originalEvent.clientX;
                        y = parentEvent.touches[0].originalEvent.clientY;
                    }
                    x = x - frameOffset.left;
                    y = y - frameOffset.top;
                } else {
                    x = event.touches[0].clientX;
                    y = event.touches[0].clientY;
                    if (event.touches[0].originalEvent) {
                        x = event.touches[0].originalEvent.clientX;
                        y = event.touches[0].originalEvent.clientY;
                    }
                }
                
                eventTarget = self.iframe.contentWindow.document.elementFromPoint(x, y);
            } else {
                x = event.clientX;
                y = event.clientY;
                if (event.originalEvent) {
                    x = event.originalEvent.clientX;
                    y = event.originalEvent.clientY;
                }
            }
            var target = $(eventTarget);
            
            if ($(target).closest(".ui-draggable-handle").length > 0) {
                return;
            }
            
            var isAlternativeDrop = false;
            if ($(target).closest("[data-cbuilder-alternative-drop]").length > 0) {
                isAlternativeDrop = true;
                if (!$(target).is("[data-cbuilder-select]")) {
                    target = $(eventTarget).closest("[data-cbuilder-select]");
                }
            } else {
                if (!$(target).is("[data-cbuilder-classname]")) {
                    target = $(eventTarget).closest("[data-cbuilder-classname]");
                }
                if ($(target).length === 0 && self.component !== undefined) {
                    target = $(eventTarget).closest("body[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]");
                }
            }
            if ($(target).length > 0)
            {
                if (self.isDragging && self.dragElement)
                {
                    if (self.elementPosX !== x && self.elementPosY !== y) {
                        self.isMoved = true;
                    }
                    self.elementPosX = x;
                    self.elementPosY = y;
                    
                    self.dragElement.attr("data-cbuilder-dragelement", "true");
                    self.frameBody.addClass("is-dragging");
                    
                    try {
                        $("#element-highlight-box").hide();
                        var parentContainerAttr = self.component.builderTemplate.getParentContainerAttr(self.data, self.component);

                        if (self.component.builderTemplate.isAbsolutePosition(self.data, self.component)) {
                            var selement = self.getElementsOnPosition(x, y, "[data-cbuilder-"+parentContainerAttr+"]");
                            if (selement !== null && selement.length > 0) {
                                var elementsContainer = $(selement);
                                if ($(selement).is('[data-cbuilder-alternative-drop]')) {
                                    target = $(selement).closest("[data-cbuilder-select]");
                                } else {
                                    target = $(selement).closest("[data-cbuilder-classname]");
                                }
                                if (elementsContainer.find(self.dragElement).length === 0) {
                                    elementsContainer.append(self.dragElement);
                                }
                                var cursorPos = self.dragElement.data("cursorPosition");
                                if (!cursorPos) {
                                    cursorPos = {x: 10, y : 10};
                                }

                                var containerOffset = elementsContainer.offset();
                                var x_offset = ((x - containerOffset.left) / self.zoom) - cursorPos.x;
                                var y_offset = ((y - containerOffset.top) /self.zoom) - cursorPos.y;

                                self.dragElement.css({
                                   "top" : y_offset + "px",
                                   "left" : x_offset + "px",
                                   "position" : "absolute"
                                });
                            } else {
                                return;
                            }
                        } else {
                            var elementsContainer = $(eventTarget).closest("[data-cbuilder-"+parentContainerAttr+"]");

                            if ($(eventTarget).is("[data-cbuilder-ignore-dragging]").length > 0 || $(eventTarget).closest("[data-cbuilder-ignore-dragging]").length > 0) {
                                var selement = self.getElementsOnPosition(x, y, "[data-cbuilder-"+parentContainerAttr+"]");
                                if (selement.length > 0) {
                                    elementsContainer = $(selement);
                                    if ($(selement).is('[data-cbuilder-alternative-drop]')) {
                                        target = $(selement).closest("[data-cbuilder-select]");
                                    } else {
                                        target = $(selement).closest("[data-cbuilder-classname]");
                                    }
                                } else {
                                    return;
                                }
                            }

                            if ($(target).parent().length > 0 && $(target).parent().is(elementsContainer)) {
                                //not container
                                var offset = $(target).offset();
                                var top = offset.top - $(self.frameDoc).scrollTop();
                                var dY = (($(target).outerHeight() * self.zoom) / 4);
                                var left = offset.left - $(self.frameDoc).scrollLeft();
                                var dX = (($(target).outerWidth() * self.zoom) / 4);

                                if ($(target).parent().is("[data-cbuilder-sort-horizontal]")) {
                                    if (x < (left + dX*2)) {
                                        $(target).before(self.dragElement);
                                    } else { 
                                        $(target).after(self.dragElement);
                                    }
                                } else {
                                    if (y < (top + dY) || (y < (top + dY * 2) && x < (left + dX*3)) || (y < (top + dY * 3) && x < (left + dX))) {
                                        $(target).before(self.dragElement);
                                    } else { 
                                        $(target).after(self.dragElement);
                                    }
                                }
                            } else {
                                //is container
                                var childs = elementsContainer.find('> [data-cbuilder-classname]');
                                if (isAlternativeDrop) {
                                    childs = elementsContainer.find('> [data-cbuilder-select]:visible');
                                }

                                if (childs.length > 0) {
                                    //when has childs, find child at x,y
                                    var child = null;
                                    var offset = null;
                                    var top = null;
                                    var left =  null;

                                    childs.each(function(){
                                        if (child === null) {
                                            offset = $(this).offset();
                                            top = offset.top - $(self.frameDoc).scrollTop();
                                            left = offset.left  - $(self.frameDoc).scrollLeft();

                                            if (y < top + ($(this).outerHeight() * self.zoom) && x < left + ($(this).outerWidth() * self.zoom)) {
                                                child = $(this);
                                            }
                                        }
                                    });

                                    if (child !== null) {
                                        var dY = ((child.outerHeight() * self.zoom) / 4);
                                        var dX = ((child.outerWidth() * self.zoom) / 4);

                                        if (elementsContainer.is("[data-cbuilder-sort-horizontal]")) {
                                            if (x < (left + dX*2)) {
                                                child.before(self.dragElement);
                                            } else { 
                                                child.after(self.dragElement);
                                            }
                                        } else {
                                            if (y < (top + dY) || (y < (top + dY * 2) && x < (left + dX*3)) || (y < (top + dY * 3) && x < (left + dX))) {
                                                child.before(self.dragElement);
                                            } else { 
                                                child.after(self.dragElement);
                                            }
                                        }
                                    } else {
                                        if (elementsContainer.is('[data-cbuilder-prepend]')) {
                                            elementsContainer.prepend(self.dragElement);
                                        } else {
                                            elementsContainer.append(self.dragElement);
                                        }
                                    }
                                } else {
                                    //when empty
                                    if (elementsContainer.is('[data-cbuilder-prepend]')) {
                                        elementsContainer.prepend(self.dragElement);
                                    } else {
                                        elementsContainer.append(self.dragElement);
                                    }
                                }
                            }
                        }
                        if (self.component.builderTemplate.dragging) {
                            self.dragElement = self.component.builderTemplate.dragging(self.dragElement, self.component);
                            self.dragElement.attr("data-cbuilder-dragelement", "true");
                        }

                        if (self.iconDrag)
                            self.iconDrag.css({'left': x + 238, 'top': y + 20});
                    } catch (err) {
                        console.log(err);
                        return false;
                    }
                } else if (!$(target).is(self.frameBody))
                {
                    self.highlight($(target), event);
                } else {
                    $("#element-highlight-box").hide();
                }
            }
        });

        self.frameHtml.off("mouseup touchend");
        self.frameHtml.on("mouseup touchend", function (event) {
            self.mousedown = false;
            if (self.isDragging)
            {
                self.isDragging = false;
                self.frameBody.removeClass("is-dragging");
                self.frameBody.find("[data-cbuilder-droparea]").removeAttr("data-cbuilder-droparea");
                
                if (self.iconDrag) {
                    self.iconDrag.remove();
                    self.iconDrag = null;
                }
         
                self.handleDropEnd();
            }
        });
        
        self.frameHtml.off("mousedown touchstart");
        self.frameHtml.on("mousedown touchstart", function (event) {
            self.mousedown = true;
            var target = $(event.target);
            if (!$(target).is("[data-cbuilder-classname]")) {
                target = $(event.target).closest("[data-cbuilder-classname]");
            }
            if ($(target).is("[data-cbuilder-unselectable]")) {
                CustomBuilder.checkChangeBeforeCloseElementProperties(function(hasChange) {
                    self.selectNode(false);
                });
                return false;
            }
            if ($(event.target).closest("[data-cbuilder-select]").length > 0) {
                target = $(event.target).closest("[data-cbuilder-select]");
            }
            if ($(event.target).is("[data-cbuilder-subelement]")) {
                target = $(event.target).parent().closest("[data-cbuilder-classname]");
            }
            if ($(target).length > 0)
            {
                try {
                    CustomBuilder.checkChangeBeforeCloseElementProperties(function(hasChange) {
                        if (hasChange) {
                            self.mousedown = false;
                        }
                        if (self.mousedown) {
                            self.selectNode(target, true);
                            if (self.component.builderTemplate.isDraggable(self.selectedElData, self.component)) {
                                $("#element-select-box").hide();
                                if (self.subSelectedEl){
                                    self.dragElement = self.subSelectedEl;
                                } else {
                                    self.dragElement = self.selectedEl;
                                }
                                self.isDragging = true;
                                self.isMoved = false;
                                self.currentParent = self.selectedEl.parent().closest("[data-cbuilder-classname]");
                                self.data = self.selectedElData;
                                
                                var x = 0;
                                var y = 0;
                                if (event.type === "touchstart") {
                                    x = event.touches[0].clientX;
                                    y = event.touches[0].clientY;
                                    if (event.touches[0].originalEvent) {
                                        x = event.touches[0].originalEvent.clientX;
                                        y = event.touches[0].originalEvent.clientY;
                                    }
                                } else {
                                    x = event.clientX;
                                    y = event.clientY;
                                    if (event.originalEvent) {
                                        x = event.originalEvent.clientX;
                                        y = event.originalEvent.clientY;
                                    }
                                }
                                self.elementPosX = x;
                                self.elementPosY = y;

                                if (self.component.builderTemplate.dragStart)
                                    self.dragElement = self.component.builderTemplate.dragStart(self.dragElement, self.component);

                                if (self.component.builderTemplate.isAbsolutePosition(self.data, self.component)) {
                                    var elementOffset = self.dragElement.offset();
                                    var xDiff = x - elementOffset.left;
                                    var yDiff = y - elementOffset.top;
                                    self.dragElement.data("cursorPosition", {"x" : xDiff, "y" : yDiff});
                                }    

                                self.frameBody.find("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]").attr("data-cbuilder-droparea", "");
                            } else {
                                self.selectNode(target);
                            }
                        } else {
                            var data = $(target).data("data");
                            if (data !== undefined) {
                                self.selectNode(target);
                            } else if(self.selectedEl) { //the clicked element is child element of previous editing element
                                target = $(self.selectedEl).find('[data-cbuilder-id="'+$(target).attr("data-cbuilder-id")+'"]');
                                self.selectNode(target);
                            }
                        }
                    });
                }catch (err){}
            } else {
                CustomBuilder.checkChangeBeforeCloseElementProperties(function(hasChange) {
                    self.selectNode(false);
                });
            }
            return false;
        });
        
        self.frameHtml.off("click");
        self.frameHtml.on("click", function (event) {
            var target = $(event.target);
            if (!$(target).is("[data-cbuilder-classname]")) {
                target = $(event.target).closest("[data-cbuilder-classname]");
            }
            if ($(target).is("[data-cbuilder-unselectable]")) {
                return false;
            }
            if ($(event.target).closest("[data-cbuilder-select]").length > 0) {
                target = $(event.target).closest("[data-cbuilder-select]");
            }
            if ($(event.target).is("[data-cbuilder-subelement]")) {
                target = $(event.target).parent().closest("[data-cbuilder-classname]");
            }
            if ($(target).length > 0)
            {
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
            event.preventDefault();
            return false;    
        });
    },
    
    /*
     * Highlight an element in canvas
     */
    highlight : function(target, event) {
        var self = CustomBuilder.Builder;
        
        if ($(event.target).closest('[data-cbuilder-select]').length > 0) {
            target = $(event.target).closest('[data-cbuilder-select]');
        }
        if ($(event.target).is("[data-cbuilder-subelement]")) {
            target = $(event.target).parent().closest("[data-cbuilder-classname]");
        }
        
        if ($(target).length > 0 && !$(target).is(self.frameBody) && !$(target).is('[data-cbuilder-uneditable]')) {
            var box = self.getBox(target);
            
            $("#element-highlight-box").css(
                    {"top": box.top - self.frameDoc.scrollTop(),
                        "left": box.left - self.frameDoc.scrollLeft(),
                        "width": box.width,
                        "height": box.height,
                        "display": event.target.hasAttribute('contenteditable') ? "none" : "block",
                        "border": self.isDragging ? "1px dashed aqua" : "", //when dragging highlight parent with green
                    });

            var nameOffset = $("#element-highlight-box").offset();
            if (nameOffset.top <= 76) {
                $("#element-highlight-name").css("top", "0px");
            } else {
                $("#element-highlight-name").css("top", "");
            }
            
            var data = target.data("data");
            if (data === undefined && $(target).is('[data-cbuilder-select]')) {
                var id = $(target).data('cbuilder-select');
                data = self.frameBody.find('[data-cbuilder-id="'+id+'"]').data("data");
            }
            if (data !== undefined) {
                self.highlightEl = target;
                var component = self.parseDataToComponent(data);
                $("#element-highlight-name").html(self._getElementType(data, component));
            } else {
                $("#element-highlight-box").hide();
                self.highlightEl = null;
            }
        } else {
            $("#element-highlight-box").hide();
            self.highlightEl = null;
        }
    },

    /*
     * Initialize the select box buttons action
     */
    _initBox: function () {
        var self = this;

        $("#down-btn, #right-btn").off("click");
        $("#down-btn, #right-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.moveNodeDown();
            event.preventDefault();
            return false;
        });

        $("#up-btn, #left-btn").off("click");
        $("#up-btn, #left-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.moveNodeUp();
            event.preventDefault();
            return false;
        });

        $("#copy-btn").off("click");
        $("#copy-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.copyNode();
            event.preventDefault();
            return false;
        });

        $("#paste-btn").off("click");
        $("#paste-btn").on("click", function (event) {
            $("#element-select-box").hide();
            self.pasteNode();
            event.preventDefault();
            return false;
        });

        $("#parent-btn").off("click");
        $("#parent-btn").on("click", function (event) {
            $("#element-select-box").hide();
            node = self.selectedEl.parent().closest("[data-cbuilder-classname]");
            self.selectNode(node);
            
            event.preventDefault();
            return false;
        });

        $("#delete-btn").off("click");
        $("#delete-btn").on("click", function (event) {
            self.deleteNode();
            event.preventDefault();
            return false;
        });
    },
    
    /*
     * Create a dummy component for permission rules and plugins
     */
    _initPermissionComponent : function() {
        CustomBuilder.initPaletteElement("", "permission-rule", "", "",[], "", false, "", {builderTemplate: {
            customPropertyOptions : function(elementOptions, element, elementObj, paletteElement){
                var propertiesDefinition;
                if (elementObj.properties.permission_key === undefined) {
                    propertiesDefinition = [
                        {
                            title : get_advtool_msg('adv.tool.permission') + " (" + get_advtool_msg('adv.permission.default') + ")",
                            properties : [{
                                name: 'permission',
                                label: get_advtool_msg('adv.tool.permission'),
                                type: 'elementselect',
                                options_callback: "CustomBuilder.getPermissionOptions",
                                url: CustomBuilder.contextPath + '/web/property/json'+CustomBuilder.appPath+'/getPropertyOptions'
                            }]
                        }
                    ];
                    if (CustomBuilder.config.advanced_tools.permission.supportNoPermisisonMessage === "true") {
                        propertiesDefinition[0]["properties"].push({
                            name : 'noPermissionMessage',
                            type : 'textarea',
                            label : get_advtool_msg('adv.permission.noPermissionMessage')
                        });  
                    }
                } else {
                    propertiesDefinition = [
                        {
                            title : get_advtool_msg('adv.tool.permission') + " (" + $(element).data("data").permission_name + ")",
                            properties : [{
                                name : 'permission_key',
                                type : 'hidden'
                            },
                            {
                                name : 'permission_name',
                                type : 'textfield',
                                label : get_advtool_msg('dependency.tree.Name'),
                                required : "true"
                            },
                            {
                                name: 'permission',
                                label: get_advtool_msg('adv.tool.permission'),
                                type: 'elementselect',
                                options_callback: "CustomBuilder.getPermissionOptions",
                                url: CustomBuilder.contextPath + '/web/property/json'+CustomBuilder.appPath+'/getPropertyOptions'
                            }]
                        }
                    ];
                }
                return propertiesDefinition;
            },
            'render' : function(element, elementObj, component, callback) {
                var name = get_advtool_msg('adv.permission.default');
                var pluginName = get_advtool_msg('adv.permission.noPlugin');

                if (elementObj.properties['permission_key'] !== undefined) {
                    name = elementObj.properties['permission_name'];
                }
                if (elementObj.properties['permission'] !== undefined && elementObj.properties['permission']["className"] !== undefined) {
                    var className = elementObj.properties['permission']["className"];
                    if (className !== "") {
                        pluginName = CustomBuilder.availablePermission[className];

                        if (pluginName === undefined) {
                            pluginName = className + "(" + get_advtool_msg('dependency.tree.Missing.Plugin') + ")";
                        }
                    }
                }
                $(element).find(".name").text(name);
                $(element).find(".plugin_name").text(pluginName);
                $("body").addClass("no-right-panel");
            }
        }});
        
        CustomBuilder.initPaletteElement("", "permission-plugin", "", "", [
            {
                title : get_advtool_msg('adv.tool.permission'),
                properties : [{
                    name: 'permission',
                    label: get_advtool_msg('adv.tool.permission'),
                    type: 'elementselect',
                    options_callback: "CustomBuilder.getPermissionOptions",
                    url: CustomBuilder.contextPath + '/web/property/json'+CustomBuilder.appPath+'/getPropertyOptions'
                },
                {
                    name : 'permissionComment',
                    type : 'textarea',
                    label : get_advtool_msg('adv.permission.permissionComment')
                }]
            }
        ], "", false, "", {builderTemplate: {}});
    },

    /*
     * Get builder component based on classname
     * Builder component are use to decide the bahavior of q component in canvas
     */
    getComponent : function(className) {
        var component = CustomBuilder.paletteElements[className];
        
        if (component === undefined) {
            return null;
        }
        
        if (component.builderTemplate === undefined || component.builderTemplate.builderReady === undefined) {
            if (component.builderTemplate === undefined) {
                component.builderTemplate = {};
            }
            component.builderTemplate = $.extend(true, {
                'render' : function(element, elementObj, component, callback) {
                    if (CustomBuilder.Builder.options.callbacks["renderElement"] !== undefined && CustomBuilder.Builder.options.callbacks["renderElement"] !== "") {
                        CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["renderElement"], [element, elementObj, component, callback]);
                    } else if (callback) {
                        callback(element);
                    }
                },
                'unload' : function(element, elementObj, component) {
                    if (CustomBuilder.Builder.options.callbacks["unloadElement"] !== undefined && CustomBuilder.Builder.options.callbacks["unloadElement"] !== "") {
                        CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["unloadElement"], [element, elementObj, component]);
                    }
                },
                'selectNode' : function(element, elementObj, component) {
                    if (CustomBuilder.Builder.options.callbacks["selectElement"] !== undefined && CustomBuilder.Builder.options.callbacks["selectElement"] !== "") {
                        CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["selectElement"], [element, elementObj, component]);
                    }
                },
                'getDragHtml' : function(elementObj, component) {
                    return this.dragHtml;
                },
                'getHtml' : function(elementObj, component) {
                    return this.html;
                },
                'getParentContainerAttr' : function(elementObj, component) {
                    return this.parentContainerAttr;
                },
                'getChildsContainerAttr' : function(elementObj, component) {
                    return this.childsContainerAttr;
                },
                'getParentDataHolder' : function(elementObj, component) {
                    return this.parentDataHolder;
                },
                'getChildsDataHolder' : function(elementObj, component) {
                    return this.childsDataHolder;
                },
                'getPasteTemporaryNode' : function(elementObj, component) {
                    return '<div></div>';
                },
                'isRenderNodeAdditional' : function(elementObj, component, type) {
                    return this.renderNodeAdditional;
                },
                'isSupportProperties' : function(elementObj, component) {
                    return this.supportProperties;
                },
                'isSupportStyle' : function(elementObj, component) {
                    return this.supportStyle;
                },
                'isDraggable' : function(elementObj, component) {
                    return this.draggable;
                },
                'isMovable' : function(elementObj, component) {
                    return this.movable;
                },
                'isDeletable' : function(elementObj, component) {
                    return this.deletable;
                },
                'isCopyable' : function(elementObj, component) {
                    return this.copyable;
                },
                'isNavigable' : function(elementObj, component) {
                    return this.navigable;
                },
                'isSubSelectAllowActions' : function(elementObj, component) {
                    return false;
                },
                'isPastable' : function(elementObj, component) {
                    var copied = CustomBuilder.getCopiedElement();
                    if (copied !== null && copied !== undefined) {
                        var copiedComponent = CustomBuilder.Builder.parseDataToComponent(copied.object);
                        if (copiedComponent !== null && copiedComponent !== undefined && component.builderTemplate.getChildsContainerAttr(elementObj, component) === copiedComponent.builderTemplate.getParentContainerAttr(copied.object, copiedComponent)) {
                            return true;
                        } else if (copiedComponent !== null && copiedComponent !== undefined && component.builderTemplate.getParentContainerAttr(elementObj, component) === copiedComponent.builderTemplate.getParentContainerAttr(copied.object, copiedComponent)) {
                            return true; //sibling
                        }
                    }
                    return false;
                },
                'isAbsolutePosition' : function(elementObj, component) {
                    return this.absolutePosition;
                },
                'isUneditable' : function(elementObj, component) {
                    return this.uneditable;
                },
                'getStylePropertiesDefinition' : function(elementObj, component) {
                    return this.stylePropertiesDefinition;
                },
                'updateProperties' : function(element, elementObj, component) {
                    
                },
                'parentContainerAttr' : 'elements',  //the html attr to locate the container of its parent
                'childsContainerAttr' : 'elements', //the html attr to locate the container of its childs
                'parentDataHolder' : 'elements', //the data attr of its parent element to store the current element
                'childsDataHolder' : 'elements', //the data attr of childs element
                'stylePropertiesDefinition' : CustomBuilder.Builder.stylePropertiesDefinition(component.builderTemplate.stylePrefix),
                'supportProperties' : true,
                'supportStyle' : true,
                'draggable' : true,
                'movable' : true,
                'deletable' : true,
                'copyable' : true,
                'navigable' : true,
                'absolutePosition' : false,
                'uneditable' : false,
                'renderNodeAdditional' : true,
                'builderReady' : true
            }, component.builderTemplate);
            
            if (CustomBuilder.Builder.options.callbacks["initComponent"] !== undefined && CustomBuilder.Builder.options.callbacks["initComponent"] !== "") {
                CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["initComponent"], [component]);
            }
        }
        
        return component;
    },

    /*
     * Initialize the drap and drop of elements in pallete
     */
    _initDragdrop: function () {

        var self = CustomBuilder.Builder;
        self.isDragging = false;

        $('.drag-elements-sidepane').off("mousedown touchstart", "ul > li > ol > li");
        $('.drag-elements-sidepane').on("mousedown touchstart", "ul > li > ol > li", function (event) {

            $this = $(this);
            if (self.iconDrag) {
                self.iconDrag.remove();
                self.iconDrag = null;
            }
            
            self.currentParent = null;
            self.component = self.getComponent($this.find("> div").attr("element-class"));
            self.data = null;
            
            var html = null;
            if (self.component.builderTemplate.getDragHtml){
                html = self.component.builderTemplate.getDragHtml(self.component);
            }
            if (html === undefined || html === null) {
                html = self.component.builderTemplate.getHtml(self.data, self.component);
            }

            self.dragElement = $(html);

            if (self.component.builderTemplate.dragStart)
                self.dragElement = self.component.builderTemplate.dragStart(self.dragElement, self.component);

            self.dragElement.attr("data-cbuilder-dragelement", "true");
            
            self.isDragging = true;
            self.isMoved = false;
            self.frameBody.addClass("is-dragging");
            self.frameBody.find("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(self.data, self.component)+"]").attr("data-cbuilder-droparea", "");
            
            self.iconDrag = $($this.html()).attr("id", "dragElement-clone").css('position', 'absolute');
            self.iconDrag.find("> a").remove();

            $('body').append(self.iconDrag);
            
            var x = 0;
            var y = 0;
            if (event.type === "touchstart") {
                x = event.touches[0].clientX;
                y = event.touches[0].clientY;
                if (event.touches[0].originalEvent) {
                    x = event.touches[0].originalEvent.clientX;
                    y = event.touches[0].originalEvent.clientY;
                }
            } else {
                x = event.clientX;
                y = event.clientY;
                if (event.originalEvent) {
                    x = event.originalEvent.clientX;
                    y = event.originalEvent.clientY;
                }
            }
            self.iconDrag.css({'left': x - 50, 'top': y - 45});

            event.preventDefault();
            return false;
        });
        
        $('.drag-elements-sidepane').off("mouseup", "ul > li > ol > li");
        $('.drag-elements-sidepane').on("mouseup", "ul > li > ol > li", function (event) {
            self.isDragging = false;
            self.frameBody.removeClass("is-dragging");
            self.frameBody.find("[data-cbuilder-droparea]").removeAttr("data-cbuilder-droparea");
            
            if (self.iconDrag) {
                self.iconDrag.remove();
                self.iconDrag = null;
            }
            if (self.dragElement) {
                self.dragElement.remove();
                self.dragElement = null;
            }
        });

        $('body').off('mouseup touchend');
        $('body').on('mouseup touchend', function (event) {
            if (self.iconDrag && self.isDragging == true)
            {
                self.isDragging = false;
                self.frameBody.removeClass("is-dragging");
                self.frameBody.find("[data-cbuilder-droparea]").removeAttr("data-cbuilder-droparea");
                
                if (self.iconDrag) {
                    self.iconDrag.remove();
                    self.iconDrag = null;
                }
                
                var x = 0;
                var y = 0;
                if (event.type === "touchend") {
                    x = event.changedTouches[0].clientX;
                    y = event.changedTouches[0].clientY;
                    if (event.changedTouches[0].originalEvent) {
                        x = event.changedTouches[0].originalEvent.clientX;
                        y = event.changedTouches[0].originalEvent.clientY;
                    }
                } else {
                    x = event.clientX;
                    y = event.clientY;
                    if (event.originalEvent) {
                        x = event.originalEvent.clientX;
                        y = event.originalEvent.clientY;
                    }
                }
                
                var elementMouseIsOver = document.elementFromPoint(x, y);
                
                if (self.dragElement && elementMouseIsOver && elementMouseIsOver.tagName !== 'IFRAME') {
                    self.dragElement.remove();
                    self.dragElement = null;
                } else {
                    self.handleDropEnd();
                }
            }
        });

        $('body').off('mousemove touchmove');
        $('body').on('mousemove touchmove', function (event) {
            if (self.iconDrag && self.isDragging == true)
            {
                event.stopPropagation();
                event.stopImmediatePropagation();
                
                var x = 0;
                var y = 0;
                if (event.type === "touchmove") {
                    x = event.touches[0].clientX;
                    y = event.touches[0].clientY;
                    if (event.touches[0].originalEvent) {
                        x = event.touches[0].originalEvent.clientX;
                        y = event.touches[0].originalEvent.clientY;
                    }
                } else {
                    x = event.clientX;
                    y = event.clientY;
                    if (event.originalEvent) {
                       x = event.originalEvent.clientX;
                       y = event.originalEvent.clientY;
                    }
                }
                self.iconDrag.css({'left': x - 50, 'top': y - 45});
                
                var elementMouseIsOver = document.elementFromPoint(x, y);

                //if drag elements hovers over iframe switch to iframe mouseover handler	
                if (elementMouseIsOver && elementMouseIsOver.tagName == 'IFRAME')
                {
                    if (event.type === "touchmove") {
                        self.frameBody.trigger("touchmove", event);
                    } else {
                        self.frameBody.trigger("mousemove", event);
                    }
                    event.stopPropagation();
                    self.selectNode(false);
                }
            }
        });
    },
    
    /*
     * Called when a drop event end to decide it is a move or add new
     */
    handleDropEnd : function() {
        var self = CustomBuilder.Builder;
        
        if (self.component.builderTemplate.dropEnd)
            self.dragElement = self.component.builderTemplate.dropEnd(self.dragElement);
        
        self.dragElement.removeAttr("data-cbuilder-dragelement");
        
        if (self.isMoved) {
            if (self.dragElement.data("cbuilder-classname") === undefined && self.dragElement.data("cbuilder-select") === undefined) {
                self.addElement();
            } else {
                self.moveElement();
            }

            CustomBuilder.update();
        } else {
            if (self.subSelectedEl) {
                self.selectNode(self.subSelectedEl);
            } else {
                self.selectNode(self.selectedEl);
            }
        }
    },
    
    /*
     * Add/render element to canvas when new element drop from pallete.
     * Also update the JSON definition
     */
    addElement : function(callback) {
        var self = CustomBuilder.Builder;
        
        if (CustomBuilder.Builder.options.callbacks["addElement"] !== undefined && CustomBuilder.Builder.options.callbacks["addElement"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["addElement"], [self.component, self.dragElement, function(elementObj){
                if (self.component.builderTemplate.isAbsolutePosition(self.data, self.component)) {
                    var position = $(self.dragElement).position();
                    elementObj.x_offset = position.left;
                    elementObj.y_offset = position.top;
                }   
                    
                CustomBuilder.Builder.renderElement(elementObj, self.dragElement, self.component, true, null, callback);
            }]);
        } else {
            var classname = self.component.className;
            var properties = {};
            
            if (self.component.properties !== undefined) {
                properties = $.extend(true, properties, self.component.properties);
            }
            if (self.component.builderTemplate.properties !== undefined) {
                properties = $.extend(true, properties, self.component.builderTemplate.properties);
            }
            
            var elementObj = {
                className: classname,
                properties: properties
            };
            
            self.updateElementId(elementObj);
            
            if (self.component.builderTemplate.isAbsolutePosition(elementObj, self.component)) {
                var position = $(self.dragElement).position();
                elementObj.x_offset = position.left;
                elementObj.y_offset = position.top;
            }
            
            var childsDataHolder = self.component.builderTemplate.getChildsDataHolder(elementObj, self.component);
            var elements = [];
            if (self.component.builderTemplate[childsDataHolder] !== undefined) {
                elements = $.extend(true, elements, self.component.builderTemplate[childsDataHolder]);
                elementObj[childsDataHolder] = elements;
            }
            
            var parent = $(self.dragElement).closest("[data-cbuilder-classname]");
            if ($(parent).length === 0) {
                parent = $(self.dragElement).closest("body");
            }
            var data = parent.data("data");

            var index = 0;
            var container = $(self.dragElement).parent().closest("[data-cbuilder-"+self.component.builderTemplate.getParentContainerAttr(elementObj, self.component)+"]");
            index = $(container).find("> *").index(self.dragElement);
            
            var parentDataArray = data[self.component.builderTemplate.getParentDataHolder(elementObj, self.component)];
            if (parentDataArray === undefined) {
                parentDataArray = [];
                data[self.component.builderTemplate.getParentDataHolder(elementObj, self.component)] = parentDataArray;
            }
            parentDataArray.splice(index, 0, elementObj);

            self.renderElement(elementObj, self.dragElement, self.component, true, null, callback);
        }
    },
    
    /*
     * Update element id to an unique value
     */
    updateElementId : function(elementObj) {
        var self = CustomBuilder.Builder;
        if (CustomBuilder.Builder.options.callbacks["updateElementId"] !== undefined && CustomBuilder.Builder.options.callbacks["updateElementId"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["updateElementId"], [elementObj]);
        } else {
            var props = self.parseElementProps(elementObj);
            props["id"] = CustomBuilder.uuid();
        }
        
        var component = self.parseDataToComponent(elementObj);
        var elements = elementObj[component.builderTemplate.getChildsDataHolder(elementObj, component)];
        
        if (elements !== undefined && elements.length > 0) {
            for (var i in elements) {
                self.updateElementId(elements[i]);
            }
        }
    },
    
    /*
     * update the JSON definition when an element is moved
     */
    moveElement : function() {
        var self = CustomBuilder.Builder;
        
        if (self.component.builderTemplate.isAbsolutePosition(self.data, self.component)) {
            var elementObj = $(self.dragElement).data("data");
            var position = $(self.dragElement).position();
            elementObj.x_offset = position.left;
            elementObj.y_offset = position.top;
        }
        
        if (CustomBuilder.Builder.options.callbacks["moveElement"] !== undefined && CustomBuilder.Builder.options.callbacks["moveElement"] !== "") {
            CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["moveElement"], [self.component, self.dragElement]);
        } else {
            self.dragElement.removeAttr("data-cbuilder-dragelement");
        
            var elementObj = $(self.selectedEl).data("data");
            
            var component = self.parseDataToComponent(elementObj);

            var parent = self.currentParent;
            if (parent.length === 0) {
                parent = self.selectedEl.closest("body");
            }
            var parentDataArray = $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            if (parentDataArray === undefined) {
                parentDataArray = [];
                $(parent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = parentDataArray;
            }
            var oldIndex = $.inArray(elementObj, parentDataArray);
            if (oldIndex !== -1) {
                parentDataArray.splice(oldIndex, 1);
            }

            var newParent = $(self.dragElement).parent().closest("[data-cbuilder-classname]");
            var newParentDataArray = $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)];
            if (newParentDataArray === undefined) {
                newParentDataArray = [];
                $(newParent).data("data")[component.builderTemplate.getParentDataHolder(elementObj, component)] = newParentDataArray;
            }
            var prev = $(self.dragElement).prev("[data-cbuilder-classname]");
            var newIndex = 0;
            if ($(prev).length > 0) {
                newIndex = $.inArray($(prev).data("data"), newParentDataArray) + 1;
            }
            newParentDataArray.splice(newIndex, 0, elementObj);

            self.checkVisible(parent);
            self.checkVisible(newParent);
            self.checkVisible(self.selectedEl);
            
            if (self.subSelectedEl) {
                self.selectNodeAndShowProperties(self.subSelectedEl, false, (!$("body").hasClass("no-right-panel")));
            } else {
                self.selectNodeAndShowProperties(self.selectedEl, false, (!$("body").hasClass("no-right-panel")));
            }
            
            self.triggerChange();
        }
    },
    
    /*
     * Re-render an element when an element is updated
     */
    updateElement : function(elementObj, element, deferreds) {
        var self = CustomBuilder.Builder;
        
        var component = self.parseDataToComponent(elementObj);
        if (component.builderTemplate !== undefined && component.builderTemplate.updateProperties !== undefined) {
            component.builderTemplate.updateProperties(element, elementObj, component);
        }
        
        self.renderElement(elementObj, element, component, true, deferreds, function(newElement){
            if (self.nodeAdditionalType !== undefined && self.nodeAdditionalType !== "") {
                var level = $(element).data("cbuilder-node-level");
                CustomBuilder.Builder.renderNodeAdditional(self.nodeAdditionalType, newElement, level);
                setTimeout(function(){
                    self._updateBoxes();
                    self.self.triggerChange();
                }, 2);
            } else {
                setTimeout(function(){
                    self._updateBoxes();
                    self.triggerChange();
                }, 2);
            }
        });
    },
    
    /*
     * Rendering an element
     */
    renderElement : function(elementObj, element, component, selectNode, deferreds, callback) {
        var self = CustomBuilder.Builder;
        var oldElement = element;
        
        $("#element-select-box").hide();
        $("#element-highlight-box").hide();
        
        if (deferreds === null || deferreds === undefined || deferreds.length === 0) {
            deferreds = [deferreds];
        }
        
        element.css("border", "");
        
        var dummy = $.Deferred();
        deferreds.push(dummy);
        
        var d = $.Deferred();
        deferreds.push(d);
        
        var html = component.builderTemplate.getHtml(elementObj, component);
        var temp;
        if (html !== undefined) {
            temp = $(html);
            
            //if properties has tagName
            var props = self.parseElementProps(elementObj);
            if (props.tagName !== undefined && props.tagName !== "") {
                var newTemp = document.createElement(props.tagName);
                attributes = temp[0].attributes;
                for (i = 0, len = attributes.length; i < len; i++) {
                    newTemp.setAttribute(attributes[i].nodeName, attributes[i].nodeValue);
                }
                temp = $(newTemp);
            }
            
            //loop properties for css class, style & attribute 
            self.handleStylingProperties(temp, props);
        }
        if (temp !== undefined && $("<div></div>").append($(temp).clone()).html().indexOf("#") === -1) {
            element.replaceWith(temp);
            element = temp;
            
            var id = props.id;
            if (id === undefined && elementObj.id !== undefined) {
                id = elementObj.id;
            }
            
            $(element).attr("data-cbuilder-classname", component.className);
            $(element).attr("data-cbuilder-id", id);
            $(element).attr("data-cbuilder-label", self._getElementType(elementObj, component));
            $(element).data("data", elementObj);
            
            if (component.builderTemplate.isAbsolutePosition(elementObj, component)) {
                $(element).attr("data-cbuilder-absolute-position", "");
                $(element).css({
                    "left" : elementObj.x_offset + "px",
                    "top" : elementObj.y_offset + "px",
                    "position" : "absolute"
                });
            }
            
            if (component.builderTemplate.isUneditable(elementObj, component)) {
                $(element).attr("data-cbuilder-uneditable", "");
            }

            self.loadAndUpdateChildElements(element, elementObj, component, deferreds);
            
            d.resolve();
        } else {
            component.builderTemplate.render(element, elementObj, component, function(newElement){
                if (newElement !== null) {
                    var props = self.parseElementProps(elementObj);
                    var id = props.id;
                    if (id === undefined && elementObj.id !== undefined) {
                        id = elementObj.id;
                    }

                    if (newElement === undefined) {
                        newElement = element;
                    }
                    $(newElement).attr("data-cbuilder-classname", component.className);
                    $(newElement).attr("data-cbuilder-id", id);
                    $(newElement).attr("data-cbuilder-label", self._getElementType(elementObj, component));
                    $(newElement).data("data", elementObj);

                    if (component.builderTemplate.isAbsolutePosition(elementObj, component)) {
                        $(newElement).attr("data-cbuilder-absolute-position", "");
                        $(newElement).css({
                            "left" : elementObj.x_offset + "px",
                            "top" : elementObj.y_offset + "px",
                            "position" : "absolute"
                        });
                    }

                    if (component.builderTemplate.isUneditable(elementObj, component)) {
                        $(element).attr("data-cbuilder-uneditable", "");
                    }

                    self.loadAndUpdateChildElements(newElement, elementObj, component, deferreds);
                    element = newElement;
                }
                
                d.resolve();
            });
        }
        
        dummy.resolve();
        
        $.when.apply($, deferreds).then(function() {
            self.checkVisible(element);
            self.checkVisible(element.parent().closest("[data-cbuilder-classname]"));

            if (selectNode) {
                if ($(oldElement).is($(self.selectedEl))) {
                    self.selectedEl = element;
                } else {
                    self.selectNodeAndShowProperties(element, false, (!$("body").hasClass("no-right-panel")));
                }
            }

            if (callback) {
                callback(element);
            }

            self.triggerChange();
        });
    },
    
    /*
     * Used to apply element styling based on properties
     */
    handleStylingProperties: function(element, properties, prefix, cssStyleClass) {
        element.removeAttr("data-cbuilder-mobile-invisible");
        element.removeAttr("data-cbuilder-tablet-invisible");
        element.removeAttr("data-cbuilder-desktop-invisible");
        if (cssStyleClass !== undefined && cssStyleClass !== null && cssStyleClass !== "") {
            element.find('> style[data-cbuilder-style="'+cssStyleClass+'"]').remove();
        }
        
        if (prefix === undefined) {
            prefix = "";
        } else {
            prefix += "-";
        }
        
        var desktopStyle = "";
        var tabletStyle = "";
        var mobileStyle = "";
        var hoverDesktopStyle = "";
        var hoverTabletStyle = "";
        var hoverMobileStyle = "";
        
        var getStyle = function(value, key, prefix) {
            if (key === (prefix + "custom")) {
                var values = value.split(";");
                var temp = "";
                for (var v in values) {
                    if (values[v] !== "") {
                        if (values[v].indexOf("!important") === -1) {
                            values[v] += " !important";
                        }
                        temp += values[v] + ";";
                    }
                }
                return temp;
            } else {
                return key.replace(prefix, "") + ":" + value + " !important;";
            }
        };
        
        for (var property in properties) {
            if (properties.hasOwnProperty(property)) {
                if (property.indexOf(prefix+'attr-') === 0) {
                    var key = property.replace(prefix+'attr-', '');
                    element.attr(key, properties[property]);
                } else if (property.indexOf(prefix+'css-') === 0) {
                    if (properties[property] !== "") {
                        element.addClass(properties[property]);
                    }
                } else if (property.indexOf(prefix+'style-') === 0) {
                    var value = properties[property];
                    if (property.indexOf('-background-image') > 0) {
                        if (value.indexOf("#appResource.") === 0) {
                            value = value.replace("#appResource.", CustomBuilder.contextPath + '/web/app/' + CustomBuilder.appId + '/resources/');
                            value = value.substring(0, value.length -1);
                        }
                        value = "url('" + value + "')";
                    }
                    
                    if (property.indexOf(prefix+'style-hover-mobile-') === 0) {
                        hoverMobileStyle += getStyle(value, property, prefix+'style-hover-mobile-');
                    } else if (property.indexOf(prefix+'style-hover-tablet-') === 0) {
                        hoverTabletStyle += getStyle(value, property, prefix+'style-hover-tablet-');
                    } else if (property.indexOf(prefix+'style-hover-') === 0) {
                        hoverDesktopStyle += getStyle(value, property, prefix+'style-hover-');
                    } else if (property.indexOf(prefix+'style-mobile-') === 0) {
                        var key = property.replace(prefix+'style-mobile-', '');
                        mobileStyle += getStyle(value, property, prefix+'style-mobile-');
                        
                        if (key === "display" && value === "none") {
                            element.attr("data-cbuilder-mobile-invisible", "");
                        }
                    } else if (property.indexOf(prefix+'style-tablet-') === 0) {
                        var key = property.replace(prefix+'style-tablet-', '');
                        tabletStyle += getStyle(value, property, prefix+'style-tablet-');
                        
                        if (key === "display" && value === "none") {
                            element.attr("data-cbuilder-tablet-invisible", "");
                        }
                    } else {
                        var key = property.replace(prefix+'style-', '');
                        desktopStyle += getStyle(value, property, prefix+'style-');
                        
                        if (key === "display" && value === "none") {
                            element.attr("data-cbuilder-desktop-invisible", "");
                        }
                    }
                }
            }
        }
        
        //if has text content
        if (properties[prefix+"textContent"] !== undefined) {
            if (element.is('[data-cbuilder-textContent]')) {
                element.html(properties[prefix+"textContent"]);
            } else {
                element.find('[data-cbuilder-textContent]').html(properties[prefix+"textContent"]);
            }
        }
        
        var builderStyles = "";
        if (desktopStyle !== "" || tabletStyle !== "" || mobileStyle !== "") {
           var styleClass = cssStyleClass;
           if (styleClass === undefined || styleClass === null || styleClass === "") {
                styleClass = "builder-style-"+CustomBuilder.uuid();
                element.addClass(styleClass);
                styleClass = "." + styleClass;
           }
           
           builderStyles = "<style data-cbuilder-style='"+styleClass+"'>";
           if (desktopStyle !== "") {
               builderStyles += styleClass + "{" + desktopStyle + "} ";
           }
           if (tabletStyle !== "") {
               builderStyles += "@media (max-width: 991px) {" + styleClass + "{" + tabletStyle + "}} ";
           }
           if (mobileStyle !== "") {
               builderStyles += "@media (max-width: 767px) {" + styleClass + "{" + mobileStyle + "}} ";
           }
           if (hoverDesktopStyle !== "") {
               builderStyles += styleClass + ":hover{" + hoverDesktopStyle + "} ";
           }
           if (hoverTabletStyle !== "") {
               builderStyles += "@media (max-width: 991px) {" + styleClass + ":hover{" + hoverTabletStyle + "}} ";
           }
           if (hoverMobileStyle !== "") {
               builderStyles += "@media (max-width: 767px) {" + styleClass + ":hover{" + hoverMobileStyle + "}} ";
           }
           builderStyles += "</style>";
           element.append(builderStyles);
        }
    },

    /*
     * Set html to canvas
     */
    setHtml: function (html)
    {
        window.FrameDocument.body.innerHTML = html;
    },

    /*
     * Add html to canvas head
     */
    setHead: function (head)
    {
        CustomBuilder.Builder.frameHead.append(head);
    },
    
    /*
     * Check an element is visible or not, if not show an invisible flag
     */
    checkVisible : function(node) {
        $(node).removeAttr("data-cbuilder-invisible");
        if (!$(node).is('[data-cbuilder-uneditable]')) {
            var temp = $('<div>'+$(node).html()+'</div>');
            $(temp).find('style').remove();
            if ($(node).is('div, p') && $(temp).html() === "") {
                $(node).attr("data-cbuilder-invisible", "");
            } else {
                var height = $(node).outerHeight();
                if ($(node).find("> .cbuilder-node-details").length > 0) {
                    height = height - $(node).find("> .cbuilder-node-details").outerHeight();
                }
                if (height === 0) {
                    $(node).attr("data-cbuilder-invisible", "");
                }
            }
        }
    },
    
    /*
     * Render the tree menu for element navigation. Used by tree viewer
     */
    renderTreeMenu: function(container, node) {
        var self = CustomBuilder.Builder;
        
        if (container.find("> ol").length === 0) {
            container.append('<ol></ol>');
        }
        
        var target = node;
        if (node === undefined) {
            target = self.frameBody;
        }
        
        $(target).find("> *").each(function() {
            if ($(this).is("[data-cbuilder-classname]") && !$(this).is("[data-cbuilder-uneditable]")) {
                var rid = "r" + (new Date().getTime());
                var data = $(this).data("data");
                var component = self.parseDataToComponent(data);
                var props = self.parseElementProps(data);
                
                if (component.builderTemplate.customPropertiesData) {
                    props = component.builderTemplate.customPropertiesData(props, data, component);
                }
                
                var label = component.label;
                if (component.builderTemplate.getLabel) {
                    label = component.builderTemplate.getLabel(data, component);
                } else if (component.builderTemplate.isSupportProperties(data, component)) {
                    if (props.label !== undefined && props.label !== "") {
                        label = props.label;
                    } else if (props.id !== undefined && props.id !== "") {
                        label = props.id;
                    }
                }
                
                var li = $('<li class="tree-viewer-item"><label>'+component.icon+' <a>'+label+'</a></label><input type="checkbox" id="'+rid+'" checked/></li>');
                $(li).data("node", $(this));
                $(li).attr("data-cbuilder-node-id", props.id);
                
                
                $(this).off("builder.selected");
                $(this).on("builder.selected", function(event) {
                    $(".tree-viewer-item").removeClass("active");
                    $(li).addClass("active");
                    
                    event.stopPropagation();
                });
                
                if (self.selectedEl && self.selectedEl.is($(this))) {
                    $(li).addClass("active");
                }
                container.find("> ol").append(li);
                
                if (component.builderTemplate.customTreeMenu) {
                    component.builderTemplate.customTreeMenu(li, data, component);
                }
                
                self.renderTreeMenu(li, $(this));
            } else {
                if (CustomBuilder.Builder.options.callbacks["renderTreeMenuAdditionalNode"] !== undefined && CustomBuilder.Builder.options.callbacks["renderTreeMenuAdditionalNode"] !== "") {
                    container = CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["renderTreeMenuAdditionalNode"], [container, $(this)]);
                }
                self.renderTreeMenu(container, $(this));
            }
        });
        
        //cleaning & attach event
        if (node === undefined) {
            container.find("li").each(function(){
                if ($(this).find("> ol > li").length === 0) {
                    $(this).find("> ol").remove();
                    $(this).find("> input").remove();
                }
            });
            
            $(container).off("click", "li.tree-viewer-item > label");
            $(container).on("click", "li.tree-viewer-item > label", function (e) {
                node = $(this).parent().data("node");
                if (node !== undefined) {
                    self.frameHtml.animate({
                        scrollTop: $(node).offset().top - 25
                    }, 1000);

                    node.trigger("mousedown").trigger("mouseup");
                }
            });
        }
    },
    
    /*
     * Used to traverling through all the nodes and render additional html to the node.
     * Used by xray viwer and permission editor
     */
    renderNodeAdditional : function(type, node, level) {
        var self = CustomBuilder.Builder;
        
        self.nodeAdditionalType = type;
        
        var target = $(node);
        if (node === undefined) {
            target = self.frameBody;
            
            $("#node-details-toggle").find("label").removeClass("active");
            $("#node-details-toggle").find("#details-toggle-all").attr("checked", "");
            $("#node-details-toggle").find("#details-toggle-all").parent().addClass("active");
            $("#node-details-toggle").find("#details-toggle-single").removeAttr("checked");
            $("#node-details-toggle").show();
            
            $("#node-details-toggle").find("input").off("click");
            $("#node-details-toggle").find("input").on("click", function(){
                if ($("#details-toggle-single").is(":checked")) {
                    self.frameBody.addClass("show-node-details-single");
                } else {
                    self.frameBody.removeClass("show-node-details-single");
                }
                self._updateBoxes();
                self.triggerEvent("nodeAdditionalModeChanged");
            });
            
            self.frameBody.addClass("show-node-details");
            level = 0;
            self.colorCount = 0;
        }
        
        var clevel = level;
        if (target.is("[data-cbuilder-classname]") && !target.is("[data-cbuilder-uneditable]")) {
            clevel++;
        }
        
        $(target).find("> *:not(.cbuilder-node-details)").each(function() {
            self.renderNodeAdditional(type, $(this), clevel);
        });
        
        if (target.is("[data-cbuilder-classname]") || target.is("[data-cbuilder-select]")) {
            var element = target;
            if (target.is("[data-cbuilder-select]")) {
                var id = $(target).data('cbuilder-select');
                element = self.frameBody.find('[data-cbuilder-id="'+id+'"]');
                if ($(element).find("> .cbuilder-node-details").length > 0) {
                    return;
                }
            } else if (!$(element).is(":visible")) {
                return;
            }
            
            if ($(element).is("[data-cbuilder-uneditable]")) {
                return;
            }
            
            var data = $(element).data("data");
            var component = self.parseDataToComponent(data);
            
            if(!component.builderTemplate.isRenderNodeAdditional(data, component, type)) {
                return;
            }
            
            var detailsDiv = $("<div class='cbuilder-node-details cbuilder-details-"+type+"' style='visibility:hidden'></div>");
            if (component.builderTemplate.addNodeDetailContainer) {
                component.builderTemplate.addNodeDetailContainer(target, detailsDiv, data, component, type);
            } else {
                $(target).prepend(detailsDiv);
            }
            $(target).attr("data-cbuilder-node-level", level);
            
            var color = level;
            if (component.builderTemplate.nodeDetailContainerColorNumber) {
                color = component.builderTemplate.nodeDetailContainerColorNumber(target, data, component, type);
            }
            
            $(detailsDiv).addClass("cbuilder-node-details-color"+color);
            $(detailsDiv).prepend("<dl class=\"cbuilder-node-details-list\"></dl>");
            
            var dl = detailsDiv.find('dl');
            var label = component.label;
            if (component.builderTemplate.getLabel) {
                label = component.builderTemplate.getLabel(data, component);
            }
            dl.append('<dt><i class="las la-cube" title="'+get_cbuilder_msg('cbuilder.type')+'"></i></dt><dd>'+label+'</dd>');

            var props = self.parseElementProps(data);
            
            if (component.builderTemplate.customPropertiesData) {
                props = component.builderTemplate.customPropertiesData(props, data, component);
            }
                
            var id = props.id;
            if (id === undefined && data.id !== undefined) {
                id = data.id;
            }
            if (props.customId !== undefined && props.customId !== "") {
                id = props.customId;
            }
            if (id !== undefined) {
                dl.append('<dt><i class="las la-id-badge" title="'+get_cbuilder_msg('cbuilder.id')+'"></i></dt><dd>'+id+'</dd>');
            }
            
            var callback = function() {
                self.adjustNodeAdditional(target);
                
                if (level === 0) {
                    CustomBuilder.Builder.triggerEvent("nodeAdditionalAdded");
                }
            };
            
            var method = component.builderTemplate["render" + type];
            if (method !== undefined) {
                component.builderTemplate["render" + type](detailsDiv, element, data, component, callback);
            } else if (CustomBuilder.Builder.options.callbacks["render" + type] !== undefined && CustomBuilder.Builder.options.callbacks["render" + type] !== "") {
                CustomBuilder.callback(CustomBuilder.Builder.options.callbacks["render" + type], [detailsDiv, element, data, component, callback]);
            } else if (CustomBuilder.Builder["render" + type] !== undefined) {
                CustomBuilder.Builder["render" + type](detailsDiv, element, data, component, callback);
            } else {
                callback();
            }
        }
    },
    
    adjustNodeAdditional : function(target) {
        var self = CustomBuilder.Builder;
        
        //check if negative margin top
        if ($(target).css("margin-top").indexOf("-") !== -1) {
            $(target).addClass("cbuilder-node-details-reset-margin-top");
        }
        
        var detailsDiv = $(target).find("> .cbuilder-node-details");
        
        //reset to empty first
        $(detailsDiv).find(".cbuilder-node-details-list").css({
            "top" : "",
            "left" : "",
            "right" : ""
        });
        $(detailsDiv).css("padding-top", "");
        $(detailsDiv).css("visibility", "hidden");

        var box = self.getBox(target);
        var dBox = self.getBox(detailsDiv, 3);
        var targetOffset = target.offset();

        var offset = 0;
        if (targetOffset.top !== box.top) {
            offset = targetOffset.top - box.top;
        }

        $(detailsDiv).find(".cbuilder-node-details-list").css({
            "top" : (box.top - dBox.top + offset) + "px",
            "left" : (box.left - dBox.left) + "px",
            "right" : ((dBox.left + dBox.width) - (box.left + box.width)) + "px"
        });

        var height = $(detailsDiv).find(".cbuilder-node-details-list").outerHeight();
        var padding = height + (box.top - dBox.top + offset) + offset;

        setTimeout(function(){
            $(detailsDiv).css("padding-top", padding + "px");
            $(detailsDiv).css("visibility", "visible");
            self._updateBoxes();
        }, 1);

        $(detailsDiv).uitooltip({
            position: { my: "left+15 center", at: "right center" }
        });
    },
    
    /*
     * Used to traverling through all the nodes and remove additional html added to the node.
     * Used by xray viwer and permission editor
     */
    removeNodeAdditional : function(node) {
        var self = CustomBuilder.Builder;
        
        self.nodeAdditionalType = "";
        
        var target = $(node);
        if (node === undefined) {
            target = self.frameBody;
            $("#node-details-toggle").hide();
            self.frameBody.removeClass("show-node-details show-node-details-single");
            self.frameBody.find(".cbuilder-node-details").remove();
            self.frameBody.find(".cbuilder-node-details-reset-margin-top").removeClass("cbuilder-node-details-reset-margin-top");
        }
        
        $(target).find(".cbuilder-node-details-wrap").each(function() {
            $(this).find("> [data-cbuilder-classname]").unwrap();
        });
        
        CustomBuilder.Builder.triggerEvent("nodeAdditionalRemoved");
    },
    
    /*
     * Default render node permisison options method for renderNodeAdditional
     */
    renderPermission : function(detailsDiv, element, elementObj, component , callback) {
        var self = CustomBuilder.Builder;
        
        var dl = detailsDiv.find('dl');
        
        //if the classname is one of the ignore class
        var ignore_classes = CustomBuilder.config.advanced_tools.permission.ignore_classes;
        if (ignore_classes.length > 0) {
            if (elementObj["className"] === null || elementObj["className"] === undefined || $.inArray(elementObj["className"], ignore_classes) !== -1) {
                callback();
                return;
            }
        }
        
        //if the element is not in the allowed child properties
        var childs_properties = CustomBuilder.config.advanced_tools.permission.childs_properties;
        var parentDataHolder = component.builderTemplate.getParentDataHolder(elementObj, component);
        if ($.inArray(parentDataHolder, childs_properties) === -1) {
            callback();
            return;
        }
        
        var props = self.parseElementProps(elementObj);
        
        var permissionObj = props;
        var key = CustomBuilder.Builder.permissionRuleKey;
        if (key !== "default") {
            if (props["permission_rules"] === undefined) {
                props["permission_rules"] = {};
            }
            if (props["permission_rules"][key] === undefined) {
                props["permission_rules"][key] = {};
            }
            permissionObj = props["permission_rules"][key];
        }
        
        //if the element should support permission plugin
        var plugins_classes = CustomBuilder.config.advanced_tools.permission.element_support_plugin;
        if ($.inArray(elementObj["className"], plugins_classes) !== -1) {
            dl.append('<dt><i class="las la-plug" title="Permission Plugin"></i></i></dt><dd><div class="permission-plugin"><span class="name"></span> <a class="edit-permission-plugin-btn"><i class="las la-edit"></i></a></div></dd>');
            var pluginName = get_advtool_msg('adv.permission.noPlugin');
            var className = "";
            if (permissionObj["permission"] !== undefined 
                && permissionObj["permission"]["className"] !== undefined  
                && permissionObj["permission"]["className"] !== "") {

                className = permissionObj["permission"]["className"];
                var pluginName = CustomBuilder.availablePermission[className];
                if (pluginName === undefined) {
                    pluginName = className + "(" + get_advtool_msg('dependency.tree.Missing.Plugin') + ")";
                }
            }
            dl.find(".permission-plugin .name").text(pluginName);

            if (permissionObj["permissionComment"] !== undefined && permissionObj["permissionComment"] !== "") {
                dl.append('<dt><i class="lar la-comment" title="Comment"></i></i></dt><dd>'+permissionObj["permissionComment"]+'</dd>');
            }
            
            dl.find(".edit-permission-plugin-btn").on("click", function() {
                self.editPermissionPlugin( element, elementObj, component);
            });
        }
        
        //if no specify callback is available, using default rendering
        var renderElementCallback = CustomBuilder.config.advanced_tools.permission.render_elements_callback;
        if (renderElementCallback !== undefined && renderElementCallback !== "") {
            CustomBuilder.callback(renderElementCallback, [detailsDiv, element, elementObj, component, permissionObj, callback]);
        } else {
            self._internalRenderPermission(detailsDiv, element, elementObj, component, permissionObj, callback);
        }
    },
    
    /*
     * show popup to edit permission plugin
     */
    editPermissionPlugin : function( element, elementObj, component) {
        var self = CustomBuilder.Builder;
        
        var props = self.parseElementProps(elementObj);
        var permissionObj = props;
        var key = CustomBuilder.Builder.permissionRuleKey;
        if (key !== "default") {
            if (props["permission_rules"] === undefined) {
                props["permission_rules"] = {};
            }
            if (props["permission_rules"][key] === undefined) {
                props["permission_rules"][key] = {};
            }
            permissionObj = props["permission_rules"][key];
        }
        CustomBuilder.editProperties("permission-plugin", permissionObj, elementObj, element);
        
        $("#style-properties-tab-link").hide();
        $("#right-panel #style-properties-tab").find(".property-editor-container").remove();
        $("body").removeClass("no-right-panel");
    },
    
    /*
     * Default implementation of rendering permission option, called from renderPermission
     */
    _internalRenderPermission : function(detailsDiv, element, elementObj, component, permissionObj, callback) {
        var self = CustomBuilder.Builder;
        var dl = detailsDiv.find('dl');
        
        var authorizedOptions = CustomBuilder.config.advanced_tools.permission.authorized;
        if (authorizedOptions !== undefined && authorizedOptions.property !== undefined && authorizedOptions.property !== "") {
            dl.append('<dt class="authorized-row" ><i class="las la-lock-open" title="'+get_advtool_msg('adv.permission.authorized')+'"></i></i></dt><dd class="authorized-row" ><div class="authorized-btns btn-group"></div></dd>');

            var value = permissionObj[authorizedOptions.property];
            if (value === undefined || value === null) {
                value = authorizedOptions.default_value;
            }

            for (var i in authorizedOptions.options) {
                var active = "";
                if (authorizedOptions.options[i]['value'] === value) {
                    active = "active";
                }
                var disableChild = "";
                if (authorizedOptions.options[i]['value'] === true) {
                    disableChild = "data-disable-child";
                }
                dl.find(".authorized-btns").append('<button type="button" class="'+active+' btn btn-outline-success btn-sm '+authorizedOptions.options[i]['key']+'-btn" data-value="'+authorizedOptions.options[i]['value']+'" '+disableChild+'>'+authorizedOptions.options[i]['label']+'</button>');
            }

            dl.on("click", ".authorized-btns .btn", function(event) {
                if ($(this).hasClass("active")) {
                    return false;
                }

                var group = $(this).closest(".btn-group");
                group.find(".active").removeClass("active");
                $(this).addClass("active");

                var selectedValue = $(this).data("value");
                permissionObj[authorizedOptions.property] = "" + selectedValue;

                $(element).find("[data-cbuilder-classname] .authorized-row .btn, [data-cbuilder-select] .authorized-row .btn").removeAttr("disabled");
                if ($(this).is("[data-disable-child]")) {
                    $(element).find("[data-cbuilder-classname] .authorized-row .btn, [data-cbuilder-select] .authorized-row .btn").addAttr("disabled");
                }
                
                var target = $(this).closest(".cbuilder-node-details").parent();
                if ($(target).is("[data-cbuilder-select]")) {
                    //copy to others
                    $(self.frameBody).find("[data-cbuilder-select='"+$(target).data("cbuilder-select")+"']").each(function(){
                        if (!$(this).is(target)) {
                            $(this).find("> .cbuilder-node-details .authorized-btns > .active").removeClass("active");
                            $(this).find("> .cbuilder-node-details .authorized-btns > [data-value='"+selectedValue+"']").addClass("active");
                        }
                    });
                }

                CustomBuilder.update();

                event.preventDefault();
                return false;
            });
        }

        var unauthorizedOptions = CustomBuilder.config.advanced_tools.permission.unauthorized;
        if (unauthorizedOptions !== undefined && unauthorizedOptions.property !== undefined && unauthorizedOptions.property !== "") {
            dl.append('<dt class="unauthorized-row" ><i class="las la-lock" title="'+get_advtool_msg('adv.permission.unauthorized')+'"></i></i></dt><dd class="unauthorized-row" ><div class="unauthorized-btns btn-group"></div></dd>');

            var value = permissionObj[unauthorizedOptions.property];
            if (value === undefined || value === null) {
                value = unauthorizedOptions.default_value;
            }

            for (var i in unauthorizedOptions.options) {
                var active = "";
                if (unauthorizedOptions.options[i]['value'] === value) {
                    active = "active";
                }
                dl.find(".unauthorized-btns").append('<button type="button" class="'+active+' btn btn-outline-danger btn-sm '+unauthorizedOptions.options[i]['key']+'-btn" data-value="'+unauthorizedOptions.options[i]['value']+'" >'+unauthorizedOptions.options[i]['label']+'</button>');
            }

            dl.on("click", ".unauthorized-btns .btn", function(event) {
                if ($(this).hasClass("active")) {
                    return false;
                }

                var group = $(this).closest(".btn-group");
                group.find(".active").removeClass("active");
                $(this).addClass("active");
                
                var selectedValue = $(this).data("value");
                permissionObj[unauthorizedOptions.property] = "" + selectedValue;

                $(element).find("[data-cbuilder-classname] .unauthorized-row .btn, [data-cbuilder-select] .unauthorized-row .btn").removeAttr("disabled");
                if ($(this).is("[data-disable-child]")) {
                    $(element).find("[data-cbuilder-classname] .unauthorized-row .btn, [data-cbuilder-select] .unauthorized-row .btn").addAttr("disabled");
                }
                
                var target = $(this).closest(".cbuilder-node-details").parent();
                if ($(target).is("[data-cbuilder-select]")) {
                    //copy to others
                    $(self.frameBody).find("[data-cbuilder-select='"+$(target).data("cbuilder-select")+"']").each(function(){
                        if (!$(this).is(target)) {
                            $(this).find("> .cbuilder-node-details .unauthorized-btns > .active").removeClass("active");
                            $(this).find("> .cbuilder-node-details .unauthorized-btns > [data-value='"+selectedValue+"']").addClass("active");
                        }
                    });
                }

                CustomBuilder.update();

                event.preventDefault();
                return false;
            });
        }
        
        if (callback) {
            callback();
        }
    },
    
    /*
     * Used to render permission rule on left panel. Used by permission editor
     */
    renderPermissionRules : function(container, ruleObject) {
        var self = CustomBuilder.Builder;
        
        container.find(".panel-header").append('<div class="btn-group responsive-btns float-right" role="group"></div>');
        container.find(".responsive-btns").append('<button class="btn btn-link btn-sm" title="'+get_advtool_msg("adv.permission.newRule")+'" id="new-rule-btn"><i class="las la-plus"></i></button>');
        container.find(".responsive-btns").append('<button class="btn btn-link btn-sm" title="'+get_advtool_msg("adv.permission.editRule")+'" id="edit-rule-btn"><i class="las la-pen"></i></button>');
        container.find(".responsive-btns").append('<button class="btn btn-link btn-sm" title="'+get_advtool_msg("adv.permission.deleteRule")+'" id="delete-rule-btn" style="display:none;"><i class="las la-trash"></i></button>');
        
        var rulesContainer = container.find(".permission-rules-container");
        rulesContainer.append("<div class=\"sortable\"></div>");
        
        if (ruleObject["permission_rules"] !== undefined) {
            for (var i in ruleObject["permission_rules"]) {
                self.renderRule(rulesContainer.find(".sortable"), ruleObject["permission_rules"][i]);
            }
        }
        
        //render default
        var defaultRule = self.renderRule(rulesContainer, ruleObject);
        self.setActiveRule(container, $(defaultRule));
        
        $(container).find(".sortable").sortable({
            opacity: 0.8,
            axis: 'y',
            handle: '.sort',
            tolerance: 'intersect',
            stop: function(event, ui){
                var newRules = [];

                $(rulesContainer).find(".sortable .permission_rule").each(function(){
                    newRules.push($(this).data("data"));
                });

                ruleObject["permission_rules"] = newRules;

                CustomBuilder.updateJson();
            }
        });
        
        $("#new-rule-btn").off("click");
        $("#new-rule-btn").on("click", function() {
            var rule = {
                permission_key : CustomBuilder.uuid(),
                permission_name : get_advtool_msg('adv.permission.unnamed'),
                permission : {
                    className : "",
                    properties : []
                }
            };

            if (ruleObject["permission_rules"] === undefined) {
                ruleObject["permission_rules"] = [];
            }
            ruleObject["permission_rules"].unshift(rule);

            var ruleElm = self.renderRule(rulesContainer.find(".sortable"), rule, true);
            self.setActiveRule(container, $(ruleElm));
            
            CustomBuilder.update();
        });
        
        $("#edit-rule-btn").off("click");
        $("#edit-rule-btn").on("click", function() {
            var rule = rulesContainer.find(".active");
            self.editPermissionRule(rule);
        });
        
        $("#delete-rule-btn").off("click");
        $("#delete-rule-btn").on("click", function() {
            var rule = rulesContainer.find(".sortable .active");
            
            var key = $(rule).data("key");
            var index = -1;
            for (var i = 0; i < ruleObject["permission_rules"].length; i++) {
                if (ruleObject["permission_rules"][i]["permission_key"] === key) {
                    index = i;
                    break;
                }
            }
            if (index > -1) {
                ruleObject["permission_rules"].splice(index, 1);

                self.removeElementsPermission(key);
                $(rule).remove();

                if ($(rulesContainer).find(".sortable .permission_rule").length > 0) {
                    self.setActiveRule(container, $(rulesContainer).find(".sortable .permission_rule:eq(0)"));
                } else {
                    self.setActiveRule(container, $(rulesContainer).find(".permission_rule.default"));
                }

                CustomBuilder.update();
            }
        });
        
        container.off("click", ".permission_rule");
        container.on("click", ".permission_rule", function(){
            self.setActiveRule(container, $(this));
        });
    },
    
    /*
     * Render rule on left panel
     */
    renderRule : function(container, obj, prepend) {
        var isDefault = true;
        var key = "default";
        var name = get_advtool_msg('adv.permission.default');
        var pluginName = get_advtool_msg('adv.permission.noPlugin');
        
        if (obj['permission_key'] !== undefined) {
            isDefault = false;
            key = obj['permission_key'];
            name = obj['permission_name'];
        }
        if (obj['permission'] !== undefined && obj['permission']["className"] !== undefined) {
            var className = obj['permission']["className"];
            if (className !== "") {
                pluginName = CustomBuilder.availablePermission[className];
                
                if (pluginName === undefined) {
                    pluginName = className + "(" + get_advtool_msg('dependency.tree.Missing.Plugin') + ")";
                }
            }
        }
        var rule = $('<div class="permission_rule"><div class="sort"></div><div class="name"></div><div class="plugin"><span class="plugin_name"></span></div></div>');
        
        $(rule).data("key", key);
        $(rule).attr("id", "permission-rule-"+key);
        $(rule).data("data", {className: "permission-rule", properties : obj});
        $(rule).find(".name").text(name);
        $(rule).find(".plugin_name").text(pluginName);
        
        if (!isDefault) {
            $(rule).find(".name").addClass("visible");
            
            if (prepend) {
                $(container).prepend(rule);
            } else {
                $(container).append(rule);
            }
            
            $(rule).find(".name").editable(function(value, settings){
                if (value === "") {
                    value = get_advtool_msg('adv.permission.unnamed');
                }
                if (obj['permission_name'] !== value) {
                    obj['permission_name'] = value;
                    CustomBuilder.updateJson();
                }
                return value;
            },{
                type      : 'text',
                tooltip   : '' ,
                select    : true ,
                style     : 'inherit',
                cssclass  : 'labelEditableField',
                onblur    : 'submit',
                rows      : 1,
                width     : '80%',
                minwidth  : 80,
                data: function(value, settings) {
                    if (value !== "") {
                        var div = document.createElement('div');
                        div.innerHTML = value;
                        var decoded = div.firstChild.nodeValue;
                        return decoded;
                    } else {
                        return value;
                    }
                }
            });
        } else {
            $(rule).addClass("default");
            $(container).append(rule);
        }
        
        return $(rule);
    },
    
    /*
     * Set active rule and render the permission options for all nodes
     */
    setActiveRule : function(container, rule) {
        container.find(".active").removeClass("active");
        rule.addClass("active");
        
        container.find("#delete-rule-btn").hide();
        if (!rule.hasClass("default")) {
            container.find("#delete-rule-btn").show();
        }
        
        CustomBuilder.Builder.permissionRuleKey = $(rule).data("key");
        
        CustomBuilder.Builder.removeNodeAdditional();
        CustomBuilder.Builder.renderNodeAdditional('Permission');
    },
    
    /*
     * Show popup to edit permission rule
     */
    editPermissionRule : function(rule) {
        $("body").addClass("no-right-panel");
        
        var self = CustomBuilder.Builder;
        
        var data = $(rule).data("data");
        var props = data.properties;
        CustomBuilder.editProperties("permission-rule", props, data, rule);
        
        $("#style-properties-tab-link").hide();
        $("#right-panel #style-properties-tab").find(".property-editor-container").remove();
        $("body").removeClass("no-right-panel");
    },
    
    /*
     * Remove permission from all nodes based on key
     */
    removeElementsPermission : function(key) {
        var self = CustomBuilder.Builder;
        self.frameBody.find("[data-cbuilder-classname]").each(function(){
            var data = $(this).data("data");
            var props = self.parseElementProps(data);
            if (props["permission_rules"] !== undefined && props["permission_rules"][key] !== undefined) {
                delete props["permission_rules"][key];
            }
        });
    },
    
    /*
     * Calculate the box position and size of a node
     */
    getBox: function(node, level) {
        var self = CustomBuilder.Builder;
        
        var offset = $(node).offset();
        var top = offset.top;
        var left = offset.left;
        var right = left + ($(node).outerWidth() * self.zoom);
        var bottom = top + ($(node).outerHeight() * self.zoom);
        
        if (level === undefined) {
            level = 0;
            
            var id = $(node).data("cbuilder-id");
            if (id !== undefined) {
                self.frameBody.find('[data-cbuilder-group="'+id+'"]').each(function(){
                    var cbox = self.getBox($(this), 2);
                    
                    if (cbox.top > 0 && cbox.top < top) {
                        top = cbox.top;
                    }
                    if (cbox.left > 0 && cbox.left < left) {
                        left = cbox.left;
                    }
                    if (cbox.right > 0 && cbox.right > right) {
                        right = cbox.right;
                    }
                    if (cbox.bottom > 0 && cbox.bottom > bottom) {
                        bottom = cbox.bottom;
                    }
                });
            }
        }
        
        if (level < 3) {
            $(node).find("> *:visible:not(.cbuilder-node-details)").each(function(){
                var cbox = self.getBox($(this), ++level);

                if (cbox.top > 0 && cbox.top < top) {
                    top = cbox.top;
                }
                if (cbox.left > 0 && cbox.left < left) {
                    left = cbox.left;
                }
                if (cbox.right > 0 && cbox.width > right) {
                    right = cbox.right;
                }
                if (cbox.bottom > 0 && cbox.height > bottom) {
                    bottom = cbox.bottom;
                }
            });
        }
        
        var box = {
            top : top,
            left : left,
            right : right,
            bottom : bottom,
            width : right - left,
            height : bottom - top
        };
        
        return box;
    },
    
    /*
     * Edit the element style on right panel
     */
    editStyles : function (elementProperties, element, elementObj, component) {
        // show property dialog
        var options = {
            appPath: "/" + CustomBuilder.appId + "/" + CustomBuilder.appVersion,
            contextPath: CustomBuilder.contextPath,
            propertiesDefinition : component.builderTemplate.getStylePropertiesDefinition(elementObj, component),
            propertyValues : elementProperties,
            showCancelButton:false,
            changeCheckIgnoreUndefined: true,
            editorPanelMode: true,
            closeAfterSaved: false,
            saveCallback: function(container, properties) {
                var d = $(container).find(".property-editor-container").data("deferred");
                d.resolve({
                    container :container, 
                    prevProperties : elementProperties,
                    properties : properties, 
                    elementObj : elementObj,
                    element : element
                });
            },
            validationFailedCallback: function(container, errors) {
                var d = $(container).find(".property-editor-container").data("deferred");
                d.resolve({
                    container :container, 
                    prevProperties : elementProperties,
                    errors : errors, 
                    elementObj : elementObj,
                    element : element
                });
            }
        };
        
        $("#style-properties-tab-link").show();
        $("#right-panel #style-properties-tab").find(".property-editor-container").remove();
        $("#right-panel #style-properties-tab").propertyEditor(options);
        
        if ($("body").hasClass("max-property-editor")) {
            CustomBuilder.adjustPropertyPanelSize();
        }
    },
    
    /*
     * Used to prepare the base element styling properties
     */
    stylePropertiesDefinition : function(prefix, title) {
        var self = CustomBuilder.Builder;
        
        if (prefix === undefined || prefix === null) {
            prefix = "";
        }
        if (title === undefined || title === null) {
            title = get_cbuilder_msg('style.styling');
        }
        
        return [
                {
                    title: title,
                    properties:[
                        {
                            name : 'normalstyle',
                            label : get_cbuilder_msg('style.normalstyle'),
                            type : 'header'
                        },
                        {
                            name : prefix+'style',
                            label : get_cbuilder_msg('style.styling.desktop'),
                            type : 'cssstyle'
                        },
                        {
                            name : prefix+'style-tablet',
                            label : get_cbuilder_msg('style.styling.tablet'),
                            type : 'cssstyle'
                        },
                        {
                            name : prefix+'style-mobile',
                            label : get_cbuilder_msg('style.styling.mobile'),
                            type : 'cssstyle'
                        },
                        {
                            name : 'hoverstyle',
                            label : get_cbuilder_msg('style.hoverstyle'),
                            type : 'header'
                        },
                        {
                            name : prefix+'style-hover',
                            label : get_cbuilder_msg('style.styling.hover.desktop'),
                            type : 'cssstyle'
                        },
                        {
                            name : prefix+'style-hover-tablet',
                            label : get_cbuilder_msg('style.styling.hover.tablet'),
                            type : 'cssstyle'
                        },
                        {
                            name : prefix+'style-hover-mobile',
                            label : get_cbuilder_msg('style.styling.hover.mobile'),
                            type : 'cssstyle'
                        }
                    ]
                }
            ];
    },
    
    /*
     * Trigger a change when there is a canvas change happen
     */
    triggerChange : function() {
        CustomBuilder.Builder.triggerEvent("change.builder");
    },
    
    /*
     * Trigger an event from canvas
     */
    triggerEvent : function(eventName) {
        setTimeout(function() {
            $(CustomBuilder.Builder.iframe).trigger(eventName);
        }, 0);
    },
    
    /*
     * A convenient method to bind to a canvas event 
     */
    bindEvent : function(eventName, callback) {
        $(CustomBuilder.Builder.iframe).off(eventName, callback);
        $(CustomBuilder.Builder.iframe).on(eventName, callback);
    },
    
    /*
     * A convenient method to unbind to a canvas event 
     */
    unbindEvent : function(eventName, callback) {
        if (callback) {
            $(CustomBuilder.Builder.iframe).off(eventName, callback);
        } else {
            $(CustomBuilder.Builder.iframe).off(eventName);
        }
    },
    
    /*
     * Used for _initHighLight to get element behind an ignored element
     */
    getElementsOnPosition : function(x, y, selector) {
        var self = CustomBuilder.Builder;
        
        //when has elements, find element at x,y
        var element = null;
        var offset = null;
        var top = null;
        var left =  null;

        self.frameBody.find(selector).each(function(){
            if (element === null) {
                offset = $(this).offset();
                top = offset.top - $(self.frameDoc).scrollTop();
                left = offset.left  - $(self.frameDoc).scrollLeft();

                if (y < top + ($(this).outerHeight() * self.zoom) && x < left + ($(this).outerWidth() * self.zoom)) {
                    element = $(this);
                }
            }
        });

        return element;
    },
    
    /*
     * Set zoom ratio for the canvas
     */
    setZoom : function(action) {
        var self = CustomBuilder.Builder;
        if (action === "-") {
            if (self.zoom > 0.5) {
                self.zoom = self.zoom - 0.1;
            }
        } else if (action === "+") {
            if (self.zoom < 1.5) {
                self.zoom = self.zoom + 0.1;
            }
        } else {
            self.zoom = 1;
        }
        self.frameBody.css({
            "transform" : "scale("+self.zoom+")",
            "transform-origin" : "0 0"
        });
        self.triggerChange();
        self._updateBoxes();
    },
    
    /*
     * Render a screesnhot for download in screenshot view
     */
    renderScreenshot : function() {
        $("#screenshotViewImage").html('<i class="las la-spinner la-3x la-spin" style="opacity:0.3"></i>');
        $("#screenshotView .sticky-buttons").html("");
        
        var self = CustomBuilder.Builder;
        
        self.frameBody.addClass("screenshot-in-progress");
        var target = self.frameBody;
        var id = CustomBuilder.id;
        
        if (self.frameBody.find('> *:eq(0)').length > 0) {
            var tempId = self.frameBody.find('> *:eq(0)').attr("data-cbuilder-id");
            if (tempId !== undefined && tempId !== "") {
                id = tempId;
            }
        }
        
        setTimeout(function() {
            CustomBuilder.getScreenshot(target, function(image){
                $("#screenshotViewImage").html('<img style="max-width:100%; border:1px solid #ddd;" src="'+image+'"/>');
                
                var link = document.createElement('a');
                link.download = CustomBuilder.appId + '-' + CustomBuilder.builderType + '-' + id+'.png';
                link.href = image;
                $(link).addClass("btn button btn-secondary");  
                $(link).html(get_cbuilder_msg('cbuilder.download'));
                $("#screenshotView .sticky-buttons").append(link);
                
                self.frameBody.removeClass("screenshot-in-progress");
            }, function(error) {
                self.frameBody.removeClass("screenshot-in-progress");
            });
        }, 300);
    }
}

CustomBuilder = $.extend(true, {}, _CustomBuilder);

var isIE11 = !!window.MSInputMethodContext && !!document.documentMode;