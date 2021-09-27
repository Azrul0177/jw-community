package org.joget.apps.userview.lib;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.joget.apps.app.service.AppUtil;
import org.joget.apps.app.service.MobileUtil;
import org.joget.apps.userview.model.SupportBuilderColorConfig;
import org.joget.apps.userview.service.UserviewThemeProcesser;
import org.joget.apps.userview.service.UserviewUtil;
import org.joget.commons.util.ResourceBundleUtil;
import org.joget.commons.util.StringUtil;
import org.joget.plugin.enterprise.UniversalTheme;
import org.joget.workflow.util.WorkflowUtil;

public class AjaxUniversalTheme extends UniversalTheme implements SupportBuilderColorConfig {
    protected Boolean isAjaxContent = null;
    
    @Override
    public String getName() {
        return "DX 8 Plain Theme";
    }

    @Override
    public String getVersion() {
        return "8.0-SNAPSHOT";
    }

    @Override
    public String getLabel() {
        return getName();
    }
    
    @Override
    public String getClassName() {
        return getClass().getName();
    }
    
    @Override
    protected String getInternalJsCssLib(Map<String, Object> data) {
        String jscss = "";
        if (!isAjaxContent(data) && !"true".equalsIgnoreCase(userview.getParamString("isPreview")) && !(data.get("is_login_page") != null && ((Boolean) data.get("is_login_page"))) && !(data.get("is_popup_view") != null && ((Boolean) data.get("is_popup_view")))) {
            jscss += "\n<script src=\"" + data.get("context_path") + "/ajaxuniversal/js/ajaxtheme.js\" async></script>";
            jscss += "\n<script>" + getContentPlaceholderRules() + "</script>";
        }
        jscss += super.getInternalJsCssLib(data);
        return jscss;
    }
    
    @Override
    public String getLayout(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            UserviewThemeProcesser processor = (UserviewThemeProcesser) data.get("processor");
            if (processor.getAlertMessage() != null && !processor.getAlertMessage().isEmpty()) {
                data.put("userview_menu_alert", "<script>alert(\"" + StringUtil.escapeString(processor.getAlertMessage(), StringUtil.TYPE_JAVASCIPT, null) + "\");</script>");
            }
            if (processor.getRedirectUrl() != null && !processor.getRedirectUrl().isEmpty() && !isCurrentUserviewUrl(processor.getRedirectUrl())) {
                data.put("content", "<script>top.location.href = \""+processor.getRedirectUrl()+"\";</script>");
                processor.setRedirectUrl(null);
            }
            return UserviewUtil.getTemplate(this, data, "/templates/ajaxuniversal/ajaxlayout.ftl");
        } else {
            if ("true".equals(getPropertyString("horizontal_menu"))) {
                data.put("body_classes", data.get("body_classes").toString() + " horizontal_menu");
            } else if ("horizontal_inline".equals(getPropertyString("horizontal_menu"))){
                data.put("body_classes", data.get("body_classes").toString() + " horizontal_menu inline_menu");
            } else if ("no".equals(getPropertyString("horizontal_menu"))) {
                data.put("body_classes", data.get("body_classes").toString() + " horizontal_menu no_menu");
            }

            if (showHomeBanner()) {
                data.put("body_classes", data.get("body_classes").toString() + " has_home_banner");
            }

            data.put("body_inner_before", "<div class=\"page-loader\"><div class=\"spinner\"></div></div>");
            return UserviewUtil.getTemplate(this, data, "/templates/userview/layout.ftl");
        }
    }
    
    @Override
    public String getHeader(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            return super.getHeader(data);
        }
    }
    
    @Override
    public String getFooter(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            return super.getFooter(data);
        }
    }
    
    @Override
    public String getContentContainer(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            data.put("content_inner_before", getBreadcrumb(data));
            return null;
        } else {
            return super.getContentContainer(data);
        }
    }
    
    @Override
    public String getMenus(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            data.put("combine_single_menu_category", true);
            return null;
        } else {
            if (!getPropertyString("logo").isEmpty()) {
                data.put("brand_logo", "<div class=\"logo_container\"><img class=\"logo\" alt=\"logo\" src=\""+getPropertyString("logo")+"\" /></div>");
            }

            data.put("nav_before", UserviewUtil.getTemplate(this, data, "/templates/ajaxuniversal/sidebar_brand.ftl"));
            
            return super.getMenus(data);
        }
    }
    
    @Override
    public String getJsCssLib(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            String jsCssLink = "";
            
            jsCssLink += "<link href=\"" + data.get("context_path") + "/wro/ajaxuniversal.preload.min.css" + "\" rel=\"stylesheet\" />\n";
            
            jsCssLink += "<link rel=\"preload\" href=\"" + data.get("context_path") + "/js/fontawesome5/fonts/fontawesome-webfont.woff2?v=4.6.1\" as=\"font\" crossorigin />\n";
            jsCssLink += "<link rel=\"preload\" href=\"" + data.get("context_path") + "/js/fontawesome5/webfonts/fa-brands-400.woff2\" as=\"font\" crossorigin />\n";
            jsCssLink += "<link rel=\"preload\" href=\"" + data.get("context_path") + "/js/fontawesome5/webfonts/fa-solid-900.woff2\" as=\"font\" crossorigin />\n";
            jsCssLink += "<link rel=\"preload\" href=\"" + data.get("context_path") + "/universal/lib/material-design-iconic-font/fonts/Material-Design-Iconic-Font.woff2?v=2.2.0\" as=\"font\" crossorigin />\n";
            jsCssLink += "<script>loadCSS(\"" + data.get("context_path") + "/wro/ajaxuniversal.min.css" + "\")</script>\n";

            jsCssLink += "<style>" + generateLessCss() + "</style>";

            jsCssLink += "<script src=\"" + data.get("context_path") + "/wro/ajaxuniversal.min.js\" async></script>\n";

            if (enableResponsiveSwitch()) {
                jsCssLink += "<script src=\"" + data.get("context_path") + "/universal/lib/responsive-switch.min.js\" defer></script>\n";
            } 
            jsCssLink += "<script>var _enableResponsiveTable = true;</script>\n";
            jsCssLink += getInternalJsCssLib(data);
            
            if (MobileUtil.isIE()) {
                jsCssLink += "<script src=\"" + data.get("context_path") + "/js/ie/fetch.js\"></script>\n";
                jsCssLink += "<script src=\"" + data.get("context_path") + "/js/ie/css-vars-ponyfill.js\"></script>\n";
                jsCssLink += "<script>cssVars();</script>\n";
            }

            return jsCssLink;
        }
    }
    
    @Override
    public Set<String> getOfflineStaticResources() {
        Set<String> urls = new HashSet<String>();
        String contextPath = AppUtil.getRequestContextPath();
        String pathName = getPathName();
        String bn = ResourceBundleUtil.getMessage("build.number");
        urls.add(contextPath + "/wro/common.css");
        urls.add(contextPath + "/wro/ajaxuniversal.preload.min.css");
        urls.add(contextPath + "/wro/ajaxuniversal.min.css");
        urls.add(contextPath + "/wro/common.preload.js?build=" + bn);
        urls.add(contextPath + "/wro/common.js?build=" + bn);
        urls.add(contextPath + "/wro/form_common.js?build=" + bn);
        urls.add(contextPath + "/wro/ajaxuniversal.preload.min.js");
        urls.add(contextPath + "/wro/ajaxuniversal.min.js");
        urls.add(contextPath + "/universal/lib/responsive-switch.min.js");
        
        return urls;
    }
    
    @Override
    public String getCss(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            return super.getCss(data);
        }
    }
    
    @Override
    public String getJs(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            return super.getJs(data);
        }
    }
    
    @Override
    public String getMetas(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            return super.getMetas(data);
        }
    }
    
    @Override
    public String getHead(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            data.put("title", StringUtil.stripAllHtmlTag(userview.getPropertyString("name")));
            return super.getHead(data);
        }
    }
    
    @Override
    public String getFavIconLink(Map<String, Object> data) {
        if (isAjaxContent(data)) {
            return "";
        } else {
            return super.getFavIconLink(data);
        }
    }
    
    @Override
    public String getLoginForm(Map<String, Object> data) {
        String name = "<div class=\"login_form_brand\">";
        if (!getPropertyString("logo").isEmpty()) {
            name += "<div class=\"login_form_logo_container\"><img class=\"logo\" alt=\"logo\" src=\""+getPropertyString("logo")+"\" /></div>";
        }
        name += "<h1>" + userview.getPropertyString("name") + "</h1></div>";
        data.put("login_form_inner_before", name);
        return super.getLoginForm(data);
    }
    
    protected boolean isAjaxContent(Map<String, Object> data) {
        if (isAjaxContent == null) {
            isAjaxContent = "true".equalsIgnoreCase(WorkflowUtil.getHttpServletRequest().getHeader("__ajax_theme_loading"));
        }
        return isAjaxContent;
    }
    
    @Override
    protected String getPrimaryColor() {
        if (!getPropertyString("dx8headerColor").isEmpty()) {
            return getPropertyString("dx8headerColor");
        }
        return "#FFFFFF";
    }
    
    @Override
    protected String generateLessCss() {
        String css = ":root{";
        if (!getPropertyString("dx8colorScheme").isEmpty()) {
            String[] colors = getPropertyString("dx8colorScheme").split(";");
            for (int i=0; i < 6; i++) {
                if (!colors[i].isEmpty()) {
                    css += "--theme-color"+(i+1)+":"+colors[i]+ ";";
                }
            }
        }
        if (!getPropertyString("dx8backgroundImage").isEmpty()) {
            css += "--theme-background-image:url('"+getPropertyString("dx8backgroundImage")+ "');";
        }
        if (!getPropertyString("dx8background").isEmpty()) {
            css += "--theme-background:"+getPropertyString("dx8background")+ ";";
        }
        if (!getPropertyString("dx8contentbackground").isEmpty()) {
            css += "--theme-content-background:"+getPropertyString("dx8contentbackground")+ ";";
        }
        if (!getPropertyString("dx8headerColor").isEmpty()) {
            css += "--theme-header:"+getPropertyString("dx8headerColor")+ ";";
        }
        if (!getPropertyString("dx8headerFontColor").isEmpty()) {
            css += "--theme-header-font:"+getPropertyString("dx8headerFontColor")+ ";";
        }
        if (!getPropertyString("dx8navBackground").isEmpty()) {
            css += "--theme-sidebar:"+getPropertyString("dx8navBackground")+ ";";
        }
        if (!getPropertyString("dx8navLinkBackground").isEmpty()) {
            css += "--theme-sidebar-link-bg:"+getPropertyString("dx8navLinkBackground")+ ";";
        }
        if (!getPropertyString("dx8navLinkColor").isEmpty()) {
            css += "--theme-sidebar-link:"+getPropertyString("dx8navLinkColor")+ ";";
        }
        if (!getPropertyString("dx8navLinkIcon").isEmpty()) {
            css += "--theme-sidebar-icon:"+getPropertyString("dx8navLinkIcon")+ ";";
        }
        if (!getPropertyString("dx8navBadge").isEmpty()) {
            css += "--theme-sidebar-badge:"+getPropertyString("dx8navBadge")+";";
        }
        if (!getPropertyString("dx8navBadgeText").isEmpty()) {
            css += "--theme-sidebar-badge-text:"+getPropertyString("dx8navBadgeText")+";";
        }
        if (!getPropertyString("dx8navActiveLinkBackground").isEmpty()) {
            css += "--theme-sidebar-active-link-bg:"+getPropertyString("dx8navActiveLinkBackground")+ ";";
        }
        if (!getPropertyString("dx8navActiveLinkColor").isEmpty()) {
            css += "--theme-sidebar-active-link:"+getPropertyString("dx8navActiveLinkColor")+ ";";
        }
        if (!getPropertyString("dx8navActiveIconColor").isEmpty()) {
            css += "--theme-sidebar-active-icon:"+getPropertyString("dx8navActiveIconColor")+ ";";
        }
        if (!getPropertyString("dx8navScrollbarThumb").isEmpty()) {
            css += "--theme-nav-scrollbar-thumb:"+getPropertyString("dx8navScrollbarThumb")+ ";";
        }
        if (!getPropertyString("dx8buttonBackground").isEmpty()) {
            css += "--theme-button-bg:"+getPropertyString("dx8buttonBackground")+ ";";
        }
        if (!getPropertyString("dx8buttonColor").isEmpty()) {
            css += "--theme-button:"+getPropertyString("dx8buttonColor")+ ";";
        }
        if (!getPropertyString("dx8primaryColor").isEmpty()) {
            css += "--theme-primary:"+getPropertyString("dx8primaryColor")+ ";";
        }
        if (!getPropertyString("dx8fontColor").isEmpty()) {
            css += "--theme-font-color:"+getPropertyString("dx8fontColor")+ ";";
        }
        if (!getPropertyString("dx8contentFontColor").isEmpty()) {
            css += "--theme-content-color:"+getPropertyString("dx8contentFontColor")+ ";";
        }
        if (!getPropertyString("dx8footerBackground").isEmpty()) {
            css += "--theme-footer-bg:"+getPropertyString("dx8footerBackground")+ ";";
        }
        if (!getPropertyString("dx8footerColor").isEmpty()) {
            css += "--theme-footer:"+getPropertyString("dx8footerColor")+ ";";
        }
        if (!getPropertyString("dx8linkColor").isEmpty()) {
            css += "--theme-link:"+getPropertyString("dx8linkColor")+ ";";
        }
        if (!getPropertyString("dx8linkActiveColor").isEmpty()) {
            css += "--theme-link-active:"+getPropertyString("dx8linkActiveColor")+ ";";
        }
        css += "}";
        return css;        
    }
    
    @Override
    public String getPropertyOptions() {
        return AppUtil.readPluginResource(getClass().getName(), "/properties/userview/ajaxUniversalTheme.json", null, true, null);
    }
    
    @Override
    public String builderThemeCss() {
        return generateLessCss();
    }
    
    protected String getContentPlaceholderRules() {
        Map<String, String> rules = getUserview().getContentPlaceholderRules();
        String script = "";
        String value = "";
        
        if (!rules.isEmpty())  {
            for (String url : rules.keySet()) {
                if (!script.isEmpty()) {
                    script += ", ";
                }
                script += "\"" + url + "\" : ";
                value = rules.get(url);
                if (value.startsWith("{") && value.endsWith("}")) {
                    script += value;
                } else {
                    script += "\"" + value + "\"";
                }
            }
            script = "var ajaxContentPlaceholder = {" + script + "};";
        }
        return script;
    }
    
    protected boolean isCurrentUserviewUrl(String url) {
        return url.contains("/web/userview/"+userview.getParamString("appId")+"/"+userview.getParamString("userviewId"));
    }
}
