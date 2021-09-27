AjaxComponent = {
    currentUrlEventListening : [],
    
    /*
     * Intialize the content to found ajax supported component and event listening component
     */
    initAjax : function(element) {
        AjaxComponent.currentUrlEventListening = [];
        $(element).find("[data-ajax-component], [data-events-triggering], [data-events-listening]").each(function() {
            AjaxComponent.overrideLinkEvent($(this));
            AjaxComponent.initContent($(this));
        });
        
        AjaxComponent.triggerPageLoadedEvent();
        AjaxComponent.triggerEvents($("#content"), window.location.href, "get");
        
        setTimeout(function(){
            $(window).trigger('resize'); //inorder for datalist to render in correct viewport
        }, 5);
    },
    
    /*
     * Override the behaviour of an AJAX supported component
     */
    initContent : function(element) {
        AjaxComponent.overrideButtonEvent(element);
        AjaxComponent.overrideDatalistButtonEvent(element);
        AjaxComponent.overrideFormEvent(element);
        AjaxComponent.initEventsListening(element);
        
        if (window["AdminBar"] !== undefined) {
            AdminBar.initQuickEditMode();
        }
    },
    
    /*
     * Override the link behaviour
     */
    overrideLinkEvent : function(element) {
        $(element).on("click", "a[href]", function(e){
            var a = $(this);
            var href = $(a).attr("href");
            var target = $(a).attr("target");
            var onclick = $(a).attr("onclick");
            if (onclick === undefined && AjaxComponent.isCurrentUserviewUrl(href) && !AjaxComponent.isDatalistExportLink(a)
                    && (target === null || target === undefined || target === "" || target === "_top" || target === "_parent" || target === "_self")) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                AjaxComponent.call($(a), href, "GET", null);
                return false;
            }
            return true;
        });
    },
    
    /*
     * Override the datalist button behaviour
     */
    overrideDatalistButtonEvent : function(element) {
        $(element).find(".dataList button[data-href]").each(function(){
            var btn = $(this);
            var url = $(btn).data("href");
            var target = $(btn).data("target");
            if (AjaxComponent.isCurrentUserviewUrl(url) 
                    && (target === null || target === undefined || target === "" || target === "_top" || target === "_parent" || target === "_self")) {
                var confirmMsg = $(btn).data("confirmation");
                $(btn).off("click");
                $(btn).removeAttr("onclick");
                $(btn).on("click", function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    if (confirmMsg === "" || confirmMsg === null || confirmMsg === undefined || confirm(confirmMsg)) {
                        AjaxComponent.call($(btn), url, "GET", null);
                    }
                    return false;
                });
            }
        });
        
        //remove pagination if only 1 page
        if ($(element).find(".dataList .pagelinks a").length === 0) {
            $(element).find(".dataList .pagelinks").css("visibility", "hidden");
        }
    },
    
    /*
     * Override the button behaviour
     */
    overrideButtonEvent : function(element) {
        $(element).find("button[onclick], input[type=button][onclick]").each(function(){
            var btn = $(this);
            var onclick = $(btn).attr("onclick");
            if (onclick.indexOf("window.location") !== -1 || onclick.indexOf("top.location") !== -1 || onclick.indexOf("parent.location") !== -1
                    || onclick.indexOf("window.document.location") !== -1 || onclick.indexOf("top.document.location") !== -1 || onclick.indexOf("parent.document.location") !== -1) {
                var url = "";
                var confirmMsg = "";
                if (onclick.indexOf("confirm(") > 0) {
                    var part = AjaxComponent.getMsgAndRedirectUrl(onclick);
                    confirmMsg = part[0];
                    url = part[1];
                } else {
                    url = onclick.match(/(['"])((?:\\\1|(?:(?!\1).))+)\1/g)[0];
                    url = url.substring(1, url.length - 1);
                }
                if (url !== "" && AjaxComponent.isCurrentUserviewUrl(url)) {
                    $(btn).off("click");
                    $(btn).removeAttr("onclick");
                    $(btn).on("click", function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        if (confirmMsg === "" || confirmMsg === null || confirmMsg === undefined || confirm(confirmMsg)) {
                            AjaxComponent.call($(btn), url, "GET", null);
                        }
                        return false;
                    });
                }
            }
            return true;
        });
    },
    
    /*
     * Override the form submission behaviour
     */
    overrideFormEvent : function(element) {
        $(element).find("form").off("submit");
        $(element).find("form").on("submit", function(e){
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            var form = $(this);
            //datalist filter form
            if ($(form).hasClass("filter_form") && $(form).closest(".dataList").length > 0) {
                 var params = $(form).serialize();
                 var queryStr = window.location.search;
                 params = params.replace(/\+/g, " ");
                 var newUrl = window.location.pathname + "?" + UrlUtil.mergeRequestQueryString(queryStr, params);
                 AjaxComponent.call($(form), newUrl, "GET", null);
            } else {
                 var formData = new FormData($(form)[0]);
                 var btn = $(this).find("input[type=submit][name]:focus, input[type=button][name]:focus, button[name]:focus" );
                 if ($(btn).length === 0 && $(this).find("input[type=submit]:focus, input[type=button]:focus, button:focus").length === 0) {
                     btn = $(this).find("input[type=submit][name], input[type=button][name], button[name]").eq(0);
                 }
                 if ($(btn).length > 0) {
                     $(btn).each(function(){
                         formData.append($(this).attr("name"), $(this).val());
                     });
                 }
                 var url = $(form).attr("action");
                 if (url === "") {
                     url = window.location.href;
                 }
                 $.unblockUI();
                 AjaxComponent.call($(form), url, "POST", formData);
            }
            
            return false;
        });
    },
    
    /*
     * Ajax call to retrieve the component html
     */
    call : function(element, url, method, formData, customCallback, customErrorCallback, isTriggerByEvent) {
        if (url.indexOf("?") === 0) {
            var currentUrl = window.location.href;
            if (currentUrl.indexOf("?") > 0) {
                currentUrl = currentUrl.substring(0, currentUrl.indexOf('?'));
            }
            url = currentUrl + url;
        } else if (url.indexOf("http") !== 0 && url.indexOf("/") !== 0) {
            var currentUrl = window.location.href;
            url = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1) + url;
        }
        
        if ($(".ma-backdrop").is(":visible")) {
            $("body").trigger("click.sidebar-toggled");
        }
        
        if (!AjaxComponent.isCurrentUserviewUrl(url)) {
            window.top.location.href = url;
            return;
        }
        
        var isAjaxComponent = false;
        if (method === "POST") {
            url = UrlUtil.updateUrlParam(url, ConnectionManager.tokenName, ConnectionManager.tokenValue);
        }
        
        var headers = new Headers();
        headers.append(ConnectionManager.tokenName, ConnectionManager.tokenValue);
        headers.append("__ajax_theme_loading", "true");
        
        var contentConatiner = $("#content");
        
        if (AjaxComponent.isCurrentUserviewPage(url)) {
            if ($(element).closest("[data-ajax-component]").length > 0) {
                isAjaxComponent = true;
                contentConatiner = $(element).closest("[data-ajax-component]");

                headers.append("__ajax_component", $(contentConatiner).attr("id"));
                
                if(isTriggerByEvent) {
                    $(contentConatiner).data("event-url", url);
                } else {
                    //merge parameter with the url trigger by event
                    if ($(contentConatiner).data("event-url") !== undefined) {
                        var qs1 = "";
                        var qs2 = "";
                        if ($(contentConatiner).data("event-url").indexOf("?") !== -1) {
                            qs1 = $(contentConatiner).data("event-url").substring($(contentConatiner).data("event-url").indexOf("?") + 1);
                        }
                        if (url.indexOf("?") !== -1) {
                            qs2 = url.substring(url.indexOf("?") + 1);
                        }
                        
                        url = window.location.pathname + "?" + UrlUtil.mergeRequestQueryString(qs1, qs2);
                    }
                }
            }
            //check it is a link clicked event, trigger event and do nothing else
            if ($(element).closest("[data-events-triggering]").length > 0 && method === "GET" && AjaxComponent.isLinkClickedEvent($(element).closest("[data-events-triggering]"), url)) {
                return;
            }
        } else {
            AjaxComponent.unbindEvents();
        }
        
        $(contentConatiner).addClass("ajaxloading");
        $(contentConatiner).attr("data-content-placeholder", AjaxComponent.getContentPlaceholder(url));
        
        var args = {
            method : method,
            headers: headers
        };
        
        if (formData !== undefined && formData !== null) {
            formData.append(ConnectionManager.tokenName, ConnectionManager.tokenValue);
            args["body"] = formData;
        }
        
        fetch(url, args)
        .then(function (response) {
            if (response.url.indexOf("/web/login") !== -1) {
                document.location.href = url;
                return null;
            } else if ((method === "GET" || response.redirected) && response.status === 200) {
                //only change url if is page change or main component
                if (!isAjaxComponent || $(contentConatiner).hasClass("main-component")) {
                    var resUrl = response.url;
                    history.pushState({url: resUrl}, "", resUrl); //handled redirected URL
                }
            }
            return response.text();
        })
        .then(function (data){
            if (data !== null) {
                if (data.indexOf("<html>") !== -1 && data.indexOf("</html>") !== -1) {
                    //handle userview redirection with alert
                    if (data.indexOf("<div>") === -1) {
                        var part = AjaxComponent.getMsgAndRedirectUrl(data.substring(data.indexOf("alert")));
                        if (part[0] !== "") {
                            alert(part[0]);
                        }

                        //if redirect url is not same with current userview page
                        if (!AjaxComponent.isCurrentUserviewPage(part[1])) {
                            AjaxComponent.call($("#content"), part[1], "GET", null);
                        } else {
                            AjaxComponent.triggerEvents(contentConatiner, url, method);
                            AjaxComponent.call(contentConatiner, part[1], "GET", null);
                        }
                        return;
                    }
                }

                if (!isAjaxComponent && AjaxUniversalTheme !== undefined) {
                    AjaxUniversalTheme.callback(data);
                } else {
                    AjaxComponent.callback(contentConatiner, data, url);
                }
                if (customCallback){
                    customCallback();
                }
                
                if (!isAjaxComponent) {
                    AjaxComponent.triggerPageLoadedEvent();
                }
                AjaxComponent.triggerEvents(contentConatiner, url, method, formData);
                
                $(contentConatiner).removeClass("ajaxloading");
                $(contentConatiner).removeAttr("data-content-placeholder");
            }
        })
        .catch(function (error) {
            if (!isAjaxComponent && AjaxUniversalTheme !== undefined) {
                AjaxUniversalTheme.errorCallback(error);
            } else {
                AjaxComponent.errorCallback(element, error);
            }
            if (customErrorCallback){
                customErrorCallback();
            }
            $(contentConatiner).removeClass("ajaxloading");
            $(contentConatiner).removeAttr("data-content-placeholder");
        });
    },
    
    /*
     * Handle the ajax callback
     */
    callback : function(element, data, url) {
        var newTarget = $(data);
        var eventUrl = $(element).data("event-url");
        $(element).replaceWith(newTarget);
        $(newTarget).data("ajax-url", url);
        if (eventUrl) {
            $(newTarget).data("event-url", eventUrl);
        }
        AjaxComponent.initContent($(newTarget));

        setTimeout(function(){
            $(window).trigger('resize'); //inorder for datalist to render in correct viewport
        }, 5);
    },
    
    /*
     * Handle the ajax error callback
     */
    errorCallback : function(element, data) {
        //ignore for now
    },
    
    isLinkClickedEvent : function(element, url) {
        return AjaxComponent.triggerEvents(element, url, "linkClicked");
    },
    
    /*
     * trigger a default page loaded event
     */
    triggerPageLoadedEvent : function() {
        var urlParams = {};
        var url = window.location.href;
        if (url.indexOf("?") !== -1) {
            urlParams = UrlUtil.getUrlParams(url.substring(url.indexOf("?") + 1));
        }
            
        AjaxComponent.triggerEvent("page_loaded", urlParams);
    },
    
    /*
     * Check the event triggering rules and trigger event
     */
    triggerEvents : function(element, url, method, formData) {
        var triggered = false;
        
        if (method === undefined) {
            method = "GET";
        }
        
        if (!$(element).is("[data-ajax-component]")) {
            element = $(element).find(".main-component");
        }
        
        if ($(element).is("[data-events-triggering]")) {
            var events = $(element).data("events-triggering");
            var urlParams = {};
            if (url.indexOf("?") !== -1) {
                urlParams = UrlUtil.getUrlParams(url.substring(url.indexOf("?") + 1));
            }
            for (var i in events) {
                var matched = true;
                
                if (events[i].ajaxMethod !== undefined && events[i].ajaxMethod.toLowerCase() !== method.toLowerCase()) {
                    matched = false;
                }
                
                var rules = events[i].parametersRules;
                if (matched && rules !== undefined && rules.length > 0) {
                    for (var r in rules) {
                        var rname = rules[r].name;
                        var op = rules[r].operator;
                        var compareValue = rules[r].value;
                        
                        var values = urlParams[rname];
                        if (values === undefined && formData !== undefined && formData.has(rname)) {
                            values = formData.get(rname);
                            if (!Array.isArray(values)) {
                                values = [values];
                            }
                        }
                        
                        if (op === "==" || op === "!=" || op === ">" || op === ">=" || op === "<" || op === "<=" || op === "true" || op === "false" || op === "in") {
                            var value = ""
                            if (!(values === null || values === undefined || values.length === 0)) {
                                value = values[0];
                            }
                            if (op === "==" && !(compareValue == value)) {
                                matched = false;
                            } else if (op === "!=" && !(compareValue != value)) {
                                matched = false;
                            } else if (op === ">" && !(compareValue >= value)) {
                                matched = false;
                            } else if (op === ">=" && !(compareValue >= value)) {
                                matched = false;
                            } else if (op === "<" && !(compareValue < value)) {
                                matched = false;
                            } else if (op === "<=" && !(compareValue <= value)) {
                                matched = false;
                            } else if (op === "true" && !(value.toLowerCase() === "true")) {
                                matched = false;
                            } else if (op === "false" && !(value.toLowerCase() === "false")) {
                                matched = false;
                            } else if (op === "in") {
                                var compareValues = compareValue.split(";");
                                if (compareValues.indexOf(value) === -1) {
                                    matched = false;
                                }
                            }
                        } else if (op === "empty" || op === "notEmpty") {
                            var isEmpty = true;
                            if (values !== null && values !== undefined && values.length > 0) {
                                for (var v in values) {
                                    if (values[v].trim().length > 0) {
                                        isEmpty = false;
                                        break;
                                    }
                                }
                            }
                            if (op === "notEmpty") {
                                matched = !isEmpty;
                            } else {
                                matched = isEmpty;
                            }
                        } else {
                            var temp = false;
                            if (op === "contains") {
                                for (var v in values) {
                                    if (values[v] === compareValue) {
                                        temp = true;
                                        break;
                                    }
                                }
                            } else if (op === "regex") {
                                var regex = new RegExp(compareValue);
                                for (var v in values) {
                                    var result = regex.exec(values[v]);
                                    if (result.length > 0 && result[0] === value) {
                                        temp = true;
                                        break;
                                    }
                                }
                            }
                            if (!temp) {
                                matched = false;
                            }
                        }
                        
                        if (!matched) {
                            break;
                        }
                    }
                }
                
                if (matched) {
                    triggered = true;
                    var eventName = events[i].name;
                    if ($(element).attr("data-pc-id") !== undefined && !$(element).is(".main-component")) {
                        eventName = eventName + "_" + $(element).attr("data-pc-id");
                    }
                    
                    AjaxComponent.triggerEvent(eventName, urlParams);
                } else if (events[i].notMatchName !== undefined && events[i].notMatchName !== "") {
                    var eventName = events[i].notMatchName;
                    if ($(element).attr("data-pc-id") !== undefined && !$(element).is(".main-component")) {
                        eventName = eventName + "_" + $(element).attr("data-pc-id");
                    }
                    
                    AjaxComponent.triggerEvent(eventName, urlParams);
                }
            }
        }
        return triggered;
    },
    
    /*
     * Trigger an event with url parameters
     */
    triggerEvent : function(name, urlParams) {
        var e = $.Event(name, urlParams);
        if (console && console.log) {
            console.log("Event `" + name + "` triggered.");
        }
        $("body").trigger(e);
    },
    
    /*
     * Based on the event listening config, listen to the event and do the action based on event
     */
    initEventsListening : function(element) {
        var listen = function(component) {
            if ($(component).is("[data-events-listening]") && !$(component).is("[data-events-listening-initialled]")) {
                var events = $(component).data("events-listening");
                var id = $(component).attr("id");
                for (var i in events) {
                    var eventName = events[i].name;
                    var eventObject = events[i].eventObject;
                    if (eventObject !== "") {
                        eventObject = "_" + eventObject;
                    }
                    if (eventName.indexOf(" ") !== -1) {
                        var temp = eventName.split(" ");
                        eventName = "";
                        for (var t in temp) {
                            if (temp[t].trim() !== "") {
                                eventName += temp[t] + eventObject + "." + id + "-" + i + " ";
                            }
                        }
                    } else {
                        eventName = eventName + eventObject + "." + id + "-" + i;
                    }

                    $("body").off(eventName);
                    $("body").on(eventName, "", {element: component, eventObj : events[i]}, function(event){
                        if (console && console.log) {
                            console.log("Event `" + event.type + "." + id + "-" + i + "` received.");
                        }
                        AjaxComponent.handleEventAction(event.data.element, event.data.eventObj, event);
                    });
                    AjaxComponent.currentUrlEventListening.push(eventName);
                }
                $(component).attr("data-events-listening-initialled", "");
            }
        };
        
        $(element).find("[data-events-listening]").each(function() {
            listen($(this));
        });
        if ($(element).is("[data-events-listening]")) {
            listen($(element));
        }
    },

    /*
     * Handle the event action when the listened event triggered
     */
    handleEventAction : function(element, eventObj, urlParams) {
        var action = eventObj.action;
        if (action === "hide") {
            $(element).hide();
        } else if (action === "show") {
            $(element).show();
        } else if (action === "reload") {
            var currentAjaxUrl = $(element).closest("[data-ajax-component]").data("ajax-url");
            if (currentAjaxUrl === undefined) {
                currentAjaxUrl = window.location.href;
            }
            AjaxComponent.call(element, currentAjaxUrl, "GET", null);
            $(element).show();
        } else if (action === "parameters") {
            var url = $(element).closest("[data-ajax-component]").data("ajax-url");
            if (url === undefined || url === null) {
                url = window.location.href;
            }
            var newUrl = AjaxComponent.updateUrlParams(url, eventObj.parameters, urlParams);
            AjaxComponent.call(element, newUrl, "GET", null, null, null, true);
            $(element).show();
        } else if (action === "reloadPage") {
            if (AjaxUniversalTheme !== undefined) {
                AjaxComponent.call($("#content"), window.location.href, "GET", null);
            } else {
                window.location.reload(true);
            }
        } else if (action === "redirectPage") {
            var url = AjaxComponent.getEventRedirectURL(eventObj.redirectUrl, urlParams);
            if (AjaxUniversalTheme !== undefined) {
               AjaxComponent.call($("#content"), url, "GET", null);
            } else {
                window.location.href = url;
            }
        } else if (action === "redirectComponent") {
            var url = AjaxComponent.getEventRedirectURL(eventObj.redirectUrl, urlParams);
            AjaxComponent.call($(element), url, "GET", null, null, null, true);
            $(element).show();
        }
    },
    
    /*
     * Used to unbind all listener in current page
     */
    unbindEvents : function () {
        for (var i in AjaxComponent.currentUrlEventListening) {
            $("body").off(AjaxComponent.currentUrlEventListening[i]);
        }
    },
    
    /*
     * Update url parameters value based on event parameters
     */
    updateUrlParams : function(url, parameters, urlParams) {      
        var params = "";
        for (var i in parameters) {
            if (parameters[i].value !== "") {
                if (params !== "") {
                    params += "&";
                }
                params += parameters[i].name + "=" + parameters[i].value;
            }
        }
        params = AjaxComponent.getEventRedirectURL(params, urlParams);
        var currentParam = "";
        if (url.indexOf("?") !== -1) {
            currentParam = url.substring(url.indexOf("?") + 1);
        }
        
        var newUrl = window.location.pathname + "?" + UrlUtil.mergeRequestQueryString(currentParam, params);
        return newUrl;
    },
    
    /*
     * Get config redirection url
     */
    getEventRedirectURL : function(url, urlParams) {
        if (url.indexOf("{") !== -1 && url.indexOf("}") !== -1) {
            url = AjaxComponent.replaceParams(url, urlParams);
        }
        return url;
    },
    
    /*
     * Replace variables in a value
     */
    replaceParams: function(value, params) {
        var regex = /(\{([a-zA-Z0-9_-]+)\})/g;
        var matches = {};
        var match = regex.exec(value);
        while (match != null) {
            matches[match[2]] = match[1];
            match = regex.exec(value);
        }
        for (var key in matches) {
            if (matches.hasOwnProperty(key)) {
                var paramValue = params[key];
                if (Array.isArray(paramValue)) {
                    paramValue = paramValue.join(";");
                }
                value = value.replaceAll(matches[key], paramValue);
            }
        }
        return value;
    },
    
    /*
     * Check the URL is within the same userview
     */
    isCurrentUserviewUrl : function(url) {
        if (url !== null && url !== undefined && url.indexOf("javascript") !== 0 && url.indexOf("/web/ulogin/") < 0) {
            if (!(url.indexOf("http") === 0 || url.indexOf("/") === 0)) {
                return true;
            } else {
                var currentPath = window.location.pathname;
                var currentOrigin = window.location.origin;
                
                if (url.indexOf("http") === 0) {
                    if (!url.indexOf(currentOrigin) === 0) {
                        return false;
                    } else {
                        url = url.replace(currentOrigin, "");
                    }
                }
                
                //remove userview key and menu id to compare
                currentPath = currentPath.replace("/web/embed", "/web");
                currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
                currentPath = currentPath.substring(0, currentPath.lastIndexOf("/"));
                url = url.replace("/web/embed", "/web");
                url = url.substring(0, url.lastIndexOf("/"));
                url = url.substring(0, url.lastIndexOf("/"));
                
                if (currentPath === url) {
                    return true;
                }
            }
        }
        
        return false;
    },
    
    /*
     * Check the URL is same userview menu
     */
    isCurrentUserviewPage : function(url) {
        if (url.indexOf("?") !== -1) {
            url = url.substring(0, url.indexOf("?"));
        }
        if (url.indexOf("/") === 0) {
            return window.location.pathname.indexOf(url) !== -1;
        } else if (url.indexOf("http") === 0) {
            var currentUrl = window.location.href;
            if (currentUrl.indexOf("?") !== -1) {
                currentUrl = currentUrl.substring(0, currentUrl.indexOf("?"));
            }
            return currentUrl === url;
        } else {
            var path = window.location.pathname;
            return path.substring(path.lastIndexOf("/")+1) === url;
        }
    },
    
    /*
     * Check a link is a datalist export
     */
    isDatalistExportLink : function(a) {
        return $(a).closest("div.exportlinks").length > 0;
    },
    
    /*
     * Extract out the alert message and redirect URL from HTML
     */
    getMsgAndRedirectUrl : function(content) {
        var part = content.indexOf(".location") > 0?content.split(".location"):content.split("location.");
        var msg = "";
        if (content.indexOf("alert") !== -1) {
            msg = part[0].match(/(['"])((?:\\\1|(?:(?!\1).))+)\1/g)[0];
            msg = msg.substring(1, msg.length - 1);
        }
        var url = part[1].match(/(['"])((?:\\\1|(?:(?!\1).))+)\1/g)[0];
        url = url.substring(1, url.length - 1);
        
        return [msg, url];
    },
    
    /*
     * Use to find the matching content placholder
     */
    getContentPlaceholder : function(url) {
        if (window["ajaxContentPlaceholder"] !== undefined) {
            var urlObj = new URL(url, window.location.origin);
            var rule = window["ajaxContentPlaceholder"][urlObj.pathname];
            if (rule !== undefined) {
                if (typeof(rule) === "string") {
                    return rule;
                } else {
                    for (var key in rule) {
                        if (rule.hasOwnProperty(key)) {
                            if (key !== "") {
                                var patt = new RegExp(key);
                                if (patt.test(urlObj.search)) {
                                    return rule[key];
                                }
                            }
                        }
                    }
                    if (rule[""] !== undefined) {
                        return rule[""];
                    }
                }
            }
        }
        return "";
    }
};

$(function(){
    AjaxComponent.initAjax($("body"));
});