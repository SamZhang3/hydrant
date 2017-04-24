var table;
var buttons = {};
var rs, hs, elig, res;
var hass_a_active, hass_h_active, hass_s_active, ci_h_active, ci_hw_active;
var cur_class;
var cur_classes = [];
var options;
var cur_option;
var all_sections;

var colors = ["#16A085", "#2980B9", "#8E44AD", "#C0392B", "#D35400", "#F39C12", "#2C3E50", "#27AE60"]

Number.prototype.format = function(n, x) {
    var re = '\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')';
    return this.toFixed(Math.max(0, ~~n)).replace(new RegExp(re, 'g'), '$&,');
};

String.prototype.paddingLeft = function (paddingValue) {
   return String(paddingValue + this).slice(-paddingValue.length);
};

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function class_sort_internal(a, b) {
    var mult;
    var len;
    
    if (a.length < b.length) {
	mult = -1;
	len = a.length;
    } else if (a.length > b.length) {
	mult = 1;
	len = b.length;
    } else {
	mult = 0;
	len = a.length;
    }

    for (i = 0; i < len; i++) {
	if (a.charAt(i) < b.charAt(i)) {
	    return -1;
	}
	else if (a.charAt(i) > b.charAt(i)) {
	    return 1;
	}
    }

    return mult;	
}

function class_sort(a, b) {
    var a_s = a.split('.');
    var b_s = b.split('.');

    var sort = class_sort_internal(a_s[0], b_s[0]);

    if (sort === 0) {
	sort = class_sort_internal(a_s[1], b_s[1]);
    }

    return sort;
}

jQuery.extend(jQuery.fn.dataTableExt.oSort, {
    "class-asc": function (a, b) {
        return class_sort(a, b);
    },
    "class-desc": function (a, b) {
        return class_sort(a, b) * -1;
    }
} );

$.fn.dataTable.ext.search.push(
    function( settings, data, dataIndex ) {
	if (!(isNaN(rs))) {
	    if (rs > parseFloat(data[1])) {
		return false;
	    }
	}

	if (!(isNaN(hs))) {
	    if (hs < parseFloat(data[2])) {
		return false;
	    }
	}

	return true;
    }
);

function search_setup() {
    $('#class-input').on( 'keyup change', function () {
        if (table.column(0).search() !== this.value ) {
            table.column(0)
                .search("^" + escapeRegExp(this.value), true, false, true)
                .draw();
            }
    } );
}

function add_cal(number, type, room, slot, length) {
    var day = Math.floor(slot / 30) + 1;
    var hour = (Math.floor((slot % 30) / 2) + 8).toString().paddingLeft("00");
    var minute = ((slot % 2) * 30).toString().paddingLeft("00");

    var end_hour = (Math.floor(((slot + length) % 30) / 2) + 8).toString().paddingLeft("00");
    var end_minute = (((slot + length) % 2) * 30).toString().paddingLeft("00");

    var type_full;

    if (type == 'l') {
	type_full = 'lec';
    } else if (type == 'r') {
	type_full = 'rec';
    } else if (type == 'b') {
	type_full = 'lab';
    }

    var index = cur_classes.indexOf(number);
    var color = colors[index % colors.length];
    
    var event = {
	title: number + ' ' + type_full + '\n' + room,
	start: '2017-05-0' + day + 'T' + hour + ':' + minute,
	end: '2017-05-0' + day + 'T' + end_hour + ':' + end_minute,
	backgroundColor: color
    };

    $("#calendar").fullCalendar('renderEvent', event, true);

    var n_number = number.replace('.', "");
    $("#" + n_number + "-button").css({
	"background-color": color,
	"border-color": color,
	"color": "#ffffff"
    });
}

function conflict_check(slot1, slot2) {
    return ((slot1[0] < slot2[0] + slot2[1]) &&
	    (slot2[0] < slot1[0] + slot1[1]))
}

function select_helper(all_sections, chosen_slots, chosen_options, cur_conflicts, min_conflicts, original=false) {
    var chosen = [];
    
    if (all_sections.length == 0) {
	return [[chosen_options], cur_conflicts]
    }

    var slot;
    var new_conflicts;
    var out;

    var new_all_sections = all_sections.slice();
    new_all_sections.shift();
    
    var section = all_sections[0];
    var slots = classes[section[0]][section[1]];

    for (var s in slots) {
	slot = slots[s][0];
	new_conflicts = 0;

	for (var cs in chosen_slots) {
	    for (var ss in slot) {
		if (conflict_check(slot[ss], chosen_slots[cs])) {
		    new_conflicts++;
		}
	    }
	}

	if (cur_conflicts + new_conflicts > min_conflicts) {
	    continue;
	}

	out = select_helper(new_all_sections,
			    chosen_slots.concat(slot),
			    chosen_options.concat(s),
			    cur_conflicts + new_conflicts,
			    min_conflicts);

	if (out[1] < min_conflicts) {
	    chosen = [];
	    min_conflicts = out[1];
	}

	if (out[1] == min_conflicts) {
	    chosen = chosen.concat(out[0]);
	}
    }

    if (original) {
	return chosen;
    } else {
	return [chosen, min_conflicts]
    }
}


function select_slots() {
    all_sections = [];
    for (var c in cur_classes) {
	for (var s in classes[cur_classes[c]]['s']) {
	    all_sections.push([classes[cur_classes[c]]['no'],
			       classes[cur_classes[c]]['s'][s].toLowerCase()])
	}
    }
    all_sections.sort(function(a, b) {
	return (classes[a[0]][a[1]].length -
		classes[b[0]][b[1]].length);
    });

    options = select_helper(all_sections, [], [], 0, 1000, true);

    set_option(0);
    $("#cal-options-2").text(options.length);

    Cookies.set('cur_classes', cur_classes);
}

function set_option(index) {
    var option = options[index];
    var slots;

    $("#calendar").fullCalendar('removeEvents');

    for (var o in option) {
	slots = classes[all_sections[o][0]][all_sections[o][1]][option[o]];
	for (var s in slots[0]) {
	    add_cal(all_sections[o][0], all_sections[o][1], slots[1],
		    slots[0][s][0], slots[0][s][1]);
	}
    }

    cur_option = index;
    $("#cal-options-1").text(cur_option + 1);

    Cookies.set('cur_option', cur_option);
}

function is_selected(number) {
    var selected = false;

    if (hass_a_active || hass_h_active || hass_s_active) {
	if (hass_a_active) {
	    if (classes[number]['ha']) {
		selected = true;
	    }
	}

	if (hass_h_active) {
	    if (classes[number]['hh']) {
		selected = true;
	    }
	}

	if (hass_s_active) {
	    if (classes[number]['hs']) {
		selected = true;
	    }
	}

	if (!selected) {
	    return false;
	}
    }

    selected = false;

    if (ci_h_active || ci_hw_active) {
	if (ci_h_active) {
	    if (classes[number]['ci']) {
		selected = true;
	    }
	}

	if (ci_hw_active) {
	    if (classes[number]['cw']) {
		selected = true;
	    }
	}

	if (!selected) {
	    return false;
	}
    }

    return true;
}

function fill_table() {
    table.clear();

    hass_a_active = $("#hass-a").is(":checked");
    hass_h_active = $("#hass-h").is(":checked");
    hass_s_active = $("#hass-s").is(":checked");
    ci_h_active = $("#ci-h").is(":checked");
    ci_hw_active = $("#ci-hw").is(":checked");
    
    for (var c in classes) {
	if (is_selected(c)) {
	    table.rows.add([[classes[c]['no'],
	   		     classes[c]['ra'].format(1),
	   		     classes[c]['h'].format(1),
	   		     classes[c]['n']]]);
	}
    }
    
    table.draw();

    search_setup();

    $('#apply').blur();
}

function class_desc(number) {
    $('#class-name').text(classes[number]['no'] + ': ' + classes[number]['n']);
    $('#class-type').html('');

    if (classes[number]['le'] == 'U') {
	$('#class-type').append('<img src="http://student.mit.edu/icns/under.gif" /> (');
    } else {
	$('#class-type').append('<img src="http://student.mit.edu/icns/grad.gif" /> (');
    }

    if (classes[number]['t'].indexOf('FA') != - 1) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/fall.gif" />,');
    }
    if (classes[number]['t'].indexOf('JA') != - 1) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/iap.gif" />,');
    }
    if (classes[number]['t'].indexOf('SP') != - 1) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/spring.gif" />,');
    }
    if (classes[number]['t'].indexOf('SU') != - 1) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/summer.gif" />,');
    }

    $('#class-type').html(function (_,txt) {
	return txt.slice(0, -1);
    }).append(') ');

    if (classes[number]['re']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/rest.gif" /> ');
    }

    if (classes[number]['la']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/Lab.gif" /> ');
    }

    if (classes[number]['hh']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/hassH.gif" /> ');
    }

    if (classes[number]['ha']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/hassA.gif" /> ');
    }

    if (classes[number]['hs']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/hassS.gif" /> ');
    }

    if (classes[number]['he']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/hassE.gif" /> ');
    }

    if (classes[number]['ci']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/cih1.gif" /> ');
    }
    if (classes[number]['cw']) {
	$('#class-type').append('<img src="http://student.mit.edu/icns/cihw.gif" /> ');
    }

    var u1 = classes[number]['u1'];
    var u2 = classes[number]['u2'];
    var u3 = classes[number]['u3'];

    $('#class-type').append('<span id="class-units"></span>')
    
    $('#class-units').text((u1 + u2 + u3) + ' units: ' + u1 + '-' + u2 + '-' + u3);

    $('#class-rating').text((classes[number]['ra']).format(1));
    $('#class-hours').text((classes[number]['h']).format(1));
    $('#class-people').text((classes[number]['si']).format(1));
    $('#class-eval').show();

    $('#class-desc').text(classes[number]['d']);

    cur_class = number;

    var n_number = number.replace('.', "");

    if (cur_classes.indexOf(number) == -1) {
	$('#class-buttons-div').html('<button type="button" class="btn btn-primary" id=' + n_number + '-add-button>Add class</button>');

	$('#' + n_number + '-add-button').click(function () {
            add_class(number);
	});
    } else {
	$('#class-buttons-div').html('<button type="button" class="btn btn-primary" id=' + n_number + '-remove-button>Remove class</button>');

	$('#' + n_number + '-remove-button').click(function () {
            remove_class(number);
	});
    }
    
}

function add_class(number) {
    if (cur_classes.indexOf(number) == -1) {
	var n_number = number.replace('.', "");
    
	$('#selected-div').append('<button type="button" class="btn btn-primary" id=' + n_number + '-button>' + number + '</button>');

	$('#' + n_number + '-button').click(function () {
            class_desc(number);
	});

	$('#' + n_number + '-button').dblclick(function () {
            remove_class(number);
	});

	cur_classes.push(number);
	class_desc(number);
	select_slots();
    }
}

function remove_class(number) {
    var n_number = number.replace('.', "");
 
    $('#' + n_number + '-button').remove();

    cur_classes.splice(cur_classes.indexOf(number), 1);
    class_desc(number);
    if (cur_classes.length == 0) {
	$("#cal-options-1").text('1');
	$("#cal-options-2").text('1');
	$("#calendar").fullCalendar('removeEvents');
    } else {
	select_slots();
    }
}

$(document).ready(function() {
    $('#calendar').fullCalendar({
	allDaySlot: false,
	columnFormat: 'dddd',
	defaultDate: '2017-05-01',
	defaultView: 'agendaWeek',
	editable: false,
	header: false,
	height: 746,
	minTime: "08:00:00",
	maxTime: "23:00:00",
	weekends: false
    });
    
    $('#eval-table tfoot th').each( function () {
        var title = $(this).text();
        $(this).html( '<input type="text" placeholder="Search '+title+'" />' );
    } );

    table = $("#eval-table").DataTable( {
	iDisplayLength: 100,
	sDom: "t",
	deferRender: true,
	order: [[0, "asc"]],
	columnDefs: [
	    { targets: [0],
	      type: "class",
	      render: function ( data, type, row, meta ) {
                  if (type === 'display'){
                      data =
			  '<a href="#">' + data + '</a>';
                }

                return data;
              } }
	],
	scrollY: "30vh"
    }); 

    fill_table();
    
    $("#eval-loading").hide();
    $("#eval-table-div").show();

    table.columns.adjust().draw();

    $('#eval-table tbody').on('click', 'tr', function () {
        var tr = $(this).closest('tr');
        var row = table.row(tr);

	class_desc(row.data()[0]);
    });

    $('#eval-table tbody').on('dblclick', 'tr', function () {
        var tr = $(this).closest('tr');
        var row = table.row(tr);
	var c = row.data()[0];

	if (cur_classes.indexOf(c) == -1) {
	    add_class(c);
	} else {
	    remove_class(c);
	}
    });

    $('#class-input').on("keypress", function(e) {
        if (e.keyCode == 13) {
	    var c = $('#class-input').val().toUpperCase();
	    if (classes.hasOwnProperty(c)) {
		add_class(c);
		$('#class-input').val('');
	    }
        }
    });

    $("#cal-left").click( function () {
	set_option((cur_option + options.length - 1) % options.length);
    });

    $("#cal-right").click( function () {
	set_option((cur_option + options.length + 1) % options.length);
    });

    var tmp_cur_classes = Cookies.getJSON('cur_classes');
    cur_option = parseInt(Cookies.get('cur_option'));

    if (cur_option != null && tmp_cur_classes != null) {
	for (var t in tmp_cur_classes) {
	    add_class(tmp_cur_classes[t]);
	}
	select_slots();
	set_option(cur_option);
    } else {
	cur_classes = [];
	cur_option = 0;
    }
});
