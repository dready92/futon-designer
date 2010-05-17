(function($) {

$.fn.menuPanel = function (opts) {
	var settings = {
		"contentCallback": null, // callback to set content: receive as an argument a callback that has to be fired
		"beforeDisplay": null,	// callback to launch just before the panel shows up
		"afterDisplay": null,	// callback to launch immediatly after the panel shows up with content as argument
		"class": null // add a custom class to the panel container
	};
	$.extend(settings,opts);

	if ( !settings.contentCallback ) {		return $(this);	}

	var removePanel = function ( button ) {
		if ( $(button).data("dropdown") ) {
			$(button).data("dropdown").hide().remove();
			$(button).removeData("dropdown");
		}
	}

	$(this).click ( function () {
		if ( $(this).data("dropdown") ) { removePanel($(this));return $(this); }
		var timeoutId = null;
		var that = this;
		var pos = $(this).position();
		var height = $(this).height();
		var marginBottom = parseInt( $(this).css('margin-bottom').replace ( /px$/,'' ) ) ;
		var borderBottom = parseInt( $(this).css('border-bottom-width').replace ( /px$/,'' ) ) ;
		var borderTop = parseInt( $(this).css('border-top-width').replace ( /px$/,'' ) ) ;
		var scrollTop = $(this).offsetParent().scrollTop();
		var panel = $("<div></div>");

		$(this).data("dropdown",panel);
		panel.css({
			"position": "absolute",
			"top": pos.top + height + scrollTop + marginBottom + borderBottom + borderTop,
			"left": pos.left
		})
		.hide()
		.mouseenter(function() {
			if ( timeoutId ) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		})
		.mouseleave(function() { setTimeout(function() { removePanel(that); },500); });

		panel.close = function () { removePanel(that); }

		if ( settings['class'] ) panel.addClass(settings['class']);

		var displayer = function (html) {
			panel.html(html);
			$(that).after(panel);
			if ( settings.beforeDisplay ) settings.beforeDisplay(panel);
			panel.show();
			if ( settings.afterDisplay ) settings.afterDisplay(panel);
		}
		settings.contentCallback( displayer );
        return $(this);
	});
    return $(this);
};

})(jQuery);