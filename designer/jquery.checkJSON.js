(function($) {


var isValidJSON = function (text) {
	var test=true;
	try { var tmp = JSON.parse(text);} catch (err) {test = false;}
	return test;
}

$.fn.checkJSON = function (classname) {
    classname = classname ? classname : "error";
	$(this).keyup (function() {
		if ( !$(this).val().length ) {
			if ( $(this).hasClass(classname) )	$(this).removeClass(classname);
			return ;
		}
		var test=isValidJSON($(this).val());
		if ( test == true && $(this).hasClass(classname) )	$(this).removeClass(classname);
		if ( test == false && !$(this).hasClass(classname) )	$(this).addClass(classname);
	});
}

})(jQuery);