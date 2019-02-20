<%@ include file="/WEB-INF/jsp/includes/taglibs.jsp" %>

<style>
    #main #main-body {
        padding: 0px;
    }
</style>
<script>
    (function ($) {
        jQuery.expr[':'].Contains = function(a,i,m){ 
            return (a.textContent || a.innerText || "").toUpperCase().indexOf(m[3].toUpperCase())>=0; 
        };

        function listFilter(header, list) {
            var form = $("<form>").attr({"class":"filterform","action":"#","onsubmit":"return false"}), 
            input = $("<input>").attr({"class":"filterinput","type":"text"}); 
            $(form).append($("<span class='filterlabel'><i class='fas fa-search'></i></span>")).append(input).appendTo(header);
            $(input) .change( function () { 
                var filter = $(this).val();
                if(filter) { 
                    $(list).find("a:not(:Contains(" + filter + "))").parent().slideUp();
                    $(list).find("a:Contains(" + filter + ")").parent().slideDown();
                } else {
                    $(list).find("li").slideDown();
                }
                return false;
            }) .keyup( function () { 
                $(this).change();
            });
        }

        $(function () {
            listFilter($("#nv-form h4"), $("#nv-form ul"));
            listFilter($("#nv-list h4"), $("#nv-list ul"));
            listFilter($("#nv-userview h4"), $("#nv-userview ul"));
            <c:forEach items="${builders}" var="builderEntry">
                listFilter($("#nv-${builderEntry.value.objectName} h4"), $("#nv-${builderEntry.value.objectName} ul"));
            </c:forEach>            
            if (parent && parent.PopupDialog.closeDialog) {
                var locationUrl = top.location.href;
                if (locationUrl.indexOf("/web/console/app") > 0 && locationUrl.indexOf("/builder/") > 0) {
                    $("#nv a.nv-link").attr("target", "_top");
                }
            }
        });
    }(jQuery));
</script>

<div id="nv" style="min-width:<c:out value="${100 + (32 * fn:length(builders))}" />%;">
    <div id="nv-form" class="nv-col nv-border">
        <button href="#" onclick="navCreate('form')" class="nv-button"><fmt:message key="console.form.create.label"/></button>
        <h4><fmt:message key="console.header.submenu.label.forms"/></h4>
        <ul class="nv-list">
            <c:forEach items="${formDefinitionList}" var="formDef">
                <li>
                    <a class="nv-link" href="${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/form/builder/${formDef.id}" target="_blank" title='<fmt:message key="console.form.common.label.id"/>: ${formDef.id};&#13;<fmt:message key="console.form.common.label.dateCreated"/>: <ui:dateToString date="${formDef.dateCreated}"/>;&#13;<fmt:message key="console.form.common.label.dateModified"/>: <ui:dateToString date="${formDef.dateModified}"/>;&#13;<fmt:message key="form.form.description"/>: <c:out value="${formDef.description}"/>'><button href="#" onclick="return checkUsageDelete('${formDef.id}', 'form', event)" class="nv-delete" title='<fmt:message key="general.method.label.delete"/>'><i class="fas fa-times"></i></button><span class="nv-link-name"><i class="fas fa-file-alt"></i> <c:out value="${formDef.name}"/></span> <span class="nv-form-table">${formDef.tableName}</span></a>
                </li>
            </c:forEach>
        </ul>
    </div>
    <div id="nv-list" class="nv-col nv-border">
        <button href="#" onclick="navCreate('datalist')" class="nv-button"><fmt:message key="console.datalist.create.label"/></button>
        <h4><fmt:message key="console.header.submenu.label.lists"/></h4>
        <ul class="nv-list">
            <c:forEach items="${datalistDefinitionList}" var="listDef">
                <li>
                    <a class="nv-link" href="${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/datalist/builder/${listDef.id}" target="_blank" title='<fmt:message key="console.datalist.common.label.id"/>: ${listDef.id};&#13;<fmt:message key="console.datalist.common.label.dateCreated"/>: <ui:dateToString date="${listDef.dateCreated}"/>;&#13;<fmt:message key="console.datalist.common.label.dateModified"/>: <ui:dateToString date="${listDef.dateModified}"/>;&#13;<fmt:message key="console.datalist.common.label.description"/>: <c:out value="${listDef.description}"/>'><button href="#" onclick="return checkUsageDelete('${listDef.id}', 'datalist', event)" class="nv-delete" title='<fmt:message key="general.method.label.delete"/>'><i class="fas fa-times"></i></button><span class="nv-link-name"><i class="fas fa-table"></i> <c:out value="${listDef.name}"/></span></a>
                </li>
            </c:forEach>
        </ul>
    </div>
    <div id="nv-userview" class="nv-col <c:if test="${fn:length(builders) > 0}"> nv-border</c:if>">
        <button href="#" onclick="navCreate('userview')" class="nv-button"><fmt:message key="console.userview.create.label"/></button>
        <h4><fmt:message key="console.header.submenu.label.userview"/></h4>
        <ul class="nv-list">
            <c:forEach items="${userviewDefinitionList}" var="userviewDef">
                <li>
                    <a class="nv-link nv-left" href="${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/userview/builder/${userviewDef.id}" target="_blank" title='<fmt:message key="console.userview.common.label.id"/>: ${userviewDef.id};&#13;<fmt:message key="console.userview.common.label.dateCreated"/>: <ui:dateToString date="${userviewDef.dateCreated}"/>;&#13;<fmt:message key="console.userview.common.label.dateModified"/>: <ui:dateToString date="${userviewDef.dateModified}"/>;&#13;<fmt:message key="console.userview.common.label.description"/>: <c:out value="${userviewDef.description}"/>'><button href="#" onclick="return checkUsageDelete('${userviewDef.id}', 'userview', event)" class="nv-delete" title='<fmt:message key="general.method.label.delete"/>'><i class="fas fa-times"></i></button><span class="nv-link-name"><i class="fas fa-desktop"></i> <c:out value="${userviewDef.name}"/></span></a>
                            <c:if test="${appDef.published}">
                        <button class="nv-button-small" onclick="window.open('${pageContext.request.contextPath}/web/userview/${appDef.id}/${userviewDef.id}')" target="_blank"><fmt:message key="console.run.launch"/></button>
                    </c:if>
                </li>
            </c:forEach>
        </ul>
    </div>
    <c:forEach items="${builders}" var="builderEntry" varStatus="loop">
        <c:set var="builderType" value="${builderEntry.key}" />
        <c:set var="builder" value="${builderEntry.value}" />
        <div id="nv-${builderType}" class="nv-col <c:if test="${!loop.last}"> nv-border</c:if>">
            <button href="#" onclick="navCreate('${builderType}')" class="nv-button"><fmt:message key="console.builder.create.label"><fmt:param value="${builder.objectLabel}"/></fmt:message></button>
            <h4>${builder.objectLabel}</h4>
            <ul class="nv-list">
                <c:forEach items="${builderDefinitionList}" var="builderDef">
                    <c:if test="${builderDef.type eq builderType}">
                        <li>
                            <a class="nv-link nv-left" href="${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/cbuilder/${builderType}/design/${builderDef.id}" target="_blank" title='<fmt:message key="console.userview.common.label.id"/>: ${builderDef.id};&#13;<fmt:message key="console.userview.common.label.dateCreated"/>: <ui:dateToString date="${builderDef.dateCreated}"/>;&#13;<fmt:message key="console.userview.common.label.dateModified"/>: <ui:dateToString date="${builderDef.dateModified}"/>;&#13;<fmt:message key="console.userview.common.label.description"/>: <c:out value="${builderDef.description}"/>'><button href="#" onclick="return checkBuilderUsageDelete('${builderDef.id}', '${builderType}', event)" class="nv-delete" title='<fmt:message key="general.method.label.delete"/>'><i class="fas fa-times"></i></button><span class="nv-link-name"><i class="${builder.icon}" style="color:${builder.color};"></i> <c:out value="${builderDef.name}"/></span></a>
                        </li>
                    </c:if>
                </c:forEach>
            </ul>
        </div>  
    </c:forEach>    
    <div id="nv-clear"></div>
</div>

<script type="text/javascript">
    <ui:popupdialog var="builderwCreateDialog" src=""/>
    function navCreate(type){
        showCreateForm(type);
    }
    function showCreateForm(type){
        if (type === "form" || type === "datalist" || type === "userview") {
            builderwCreateDialog.src = "${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/" + type + "/create?builderMode=false";
        } else {
            builderwCreateDialog.src = "${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/cbuilder/" + type + "/create?builderMode=false";
        }
        builderwCreateDialog.init();
    }
    function checkUsageDelete(id, type, event) {
        var messages = {
            'form': '<fmt:message key="console.form.delete.label.confirmation"/>',
            'datalist': '<fmt:message key="console.datalist.delete.label.confirmation"/>',
            'userview': '<fmt:message key="console.userview.delete.label.confirmation"/>',
        }
        if (confirm(messages[type])) {
            Usages.delete(id, type, {
                contextPath: '${pageContext.request.contextPath}',
                appId: '${appDef.id}',
                appVersion: '${appDef.version}',
                id: id,
                builder: type,
                confirmMessage: '<fmt:message key="dependency.usage.confirmDelete"/>',
                confirmLabel: '<fmt:message key="dependency.usage.confirmLabel"/>',
                cancelLabel: '<fmt:message key="dependency.usage.cencelLabel"/>'
            }, function () {
                window[type + 'Delete'](id, event);
            });
        }

        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    function formDelete(selectedList, event) {
        UI.blockUI();
        var callback = {
            success: function () {
                UI.unblockUI();
                refreshNavigator();
            }
        }
        ConnectionManager.post('${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/form/delete', callback, 'formId=' + selectedList);
    }
    function datalistDelete(selectedList, event) {
        UI.blockUI();
        var callback = {
            success: function () {
                UI.unblockUI();
                refreshNavigator();
            }
        }
        ConnectionManager.post('${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/datalist/delete', callback, 'ids=' + selectedList);
    }
    function userviewDelete(selectedList, event) {
        UI.blockUI();
        var callback = {
            success: function () {
                UI.unblockUI();
                refreshNavigator();
            }
        }
        ConnectionManager.post('${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/userview/delete', callback, 'ids=' + selectedList);
    }
    function checkBuilderUsageDelete(id, type, event) {
        if (confirm('<fmt:message key="console.builder.delete.label.confirmation"/>')) {
            Usages.delete(id, type, {
                contextPath: '${pageContext.request.contextPath}',
                appId: '${appDef.id}',
                appVersion: '${appDef.version}',
                id: id,
                builder: type,
                confirmMessage: '<fmt:message key="dependency.usage.confirmDelete"/>',
                confirmLabel: '<fmt:message key="dependency.usage.confirmLabel"/>',
                cancelLabel: '<fmt:message key="dependency.usage.cencelLabel"/>'
            }, function () {
                builderDelete(id, type, event);
            });
        }

        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    function builderDelete(selectedList, type, event) {
        UI.blockUI();
        var callback = {
            success: function () {
                UI.unblockUI();
                refreshNavigator();
            }
        };
        ConnectionManager.post('${pageContext.request.contextPath}/web/console/app/${appDef.id}/${appDef.version}/cbuilder/'+type+'/delete', callback, 'ids=' + selectedList);
    }
    function showInfo() {
        $(".nv-link").each(function() {
            var info = $(this).prop("title");
            info = UI.escapeHTML(info);
            info = info.replace(/: /g, ": <b>");
            info = info.replace(/;/g, "</b><br/>");
            info = info.replace(/\n/g, "<br/>");
            var sub=$("<div class='nv-subinfo'></div>").append(info);  
            $(this).append(sub);
        });
        $(".nv-link-name").addClass("nv-link-hilite");
        $("#toggleInfo i").attr("class", "fas fa-list-ul");
    }
    function hideInfo() {
        $(".nv-subinfo").remove();
        $(".nv-link-name").removeClass("nv-link-hilite");
        $("#toggleInfo i").attr("class", "fas fa-th-list");
    }
    function toggleInfo() {
        if ($(".nv-subinfo").length === 0) {
            showInfo();
        } else {
            hideInfo();
        }
    }
</script>
