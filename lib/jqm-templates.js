function TPLBackgroundlayerstoolbar (option) {
	this.option = option;
}

TPLBackgroundlayerstoolbar.prototype.init = function(){
	if (this.option === "default") {
		$("#backgroundlayerstoolbar").attr('data-type', 'horizontal').attr('data-iconpos', 'left');		
	}
	
	if (this.option === "gallery") {
		$("#backgroundlayerstoolbar").attr('data-role', 'collapsible').attr('data-theme', 'a');		
		$("#backgroundlayerstoolbar").append('<h4>Fonds de plan</h4><ul id="basemapslist" data-role="listview" ></ul>');
	}
	return this;	
}

TPLBackgroundlayerstoolbar.prototype.create = function(){
	if (this.option === "default") {		
		$("#backgroundlayerstoolbar").controlgroup();
		$("#backgroundlayerstoolbar").trigger("create");
		$("#backgroundlayerstoolbar").controlgroup("refresh");
		//hack jquerymobile 1.3.2
		$("#backgroundlayerstoolbar").navbar();
	}
	if (this.option === "gallery") {
		$("#basemapslist").trigger("create");
		$("#basemapslist").listview();
		$("#backgroundlayerstoolbar").collapsible();		
	}
}

function TPLBackgroundLayerControl (layer, option) {
	this.option = option;
	this.layer = layer;
}

TPLBackgroundLayerControl.prototype.html = function(){
	var template = "";
	if (this.option === "default") {
		template = ['<a href="#" id="' + this.layer.attr("id") + '_btn" title="' + this.layer.attr("title"),
			'" onclick="mviewer.setBaseLayer(\'' + this.layer.attr("id") + '\')"',
			'data-theme="a" data-role="button">' + this.layer.attr("label") + '</a>'].join(" ");
		$("#backgroundlayerstoolbar").append(template);
	}
	if (this.option === "gallery") {
		template = ['<li data-theme="a" onclick="mviewer.setBaseLayer(\'' +  this.layer.attr("id") + '\')">',
			'<a id="' + this.layer.attr("id") + '_btn" href="#"><img src="' +  this.layer.attr("thumbgallery") + '" />',
			'<h3>' +  this.layer.attr("label") + '</h3>',
			'<p>' + this.layer.attr("title") + '</p></a></li>'].join(" ");
		$("#basemapslist").append(template);
	}
	
}

function TPLLayergroup(title, layerlist, collapsed){   
   this.title = title;
   this.collapsed = collapsed;
   this.layerlist = layerlist;
}

TPLLayergroup.prototype.html = function(){
	return ['<div data-role="collapsible" data-collapsed="'+this.collapsed+'">',
						'<h2>'+this.title+'</h2>',    
						'<ul data-role="listview" data-split-icon="gear" data-split-theme="d" data-inset="true" data-mini="true">',		
						this.layerlist,
						'</ul>',
					'</div>'].join(" ");
}

function TPLLayercontrol(layerid, title, legendurl, queryable, checked, enabled){   
   this.layerid = layerid;
   this.title = title;   
   this.queryable = queryable;
   this.legendurl = legendurl;
   this.checked = checked;
   this.enabled = enabled;   
}

TPLLayercontrol.prototype.html = function(){
	return  ['<li data-theme="d" data-icon="false"><a href="#">',
						'<h3 class="layerdisplay-title">',
							'<table style="width:100%;" >',
									'<tbody>',
										'<tr>',
											'<td>'+this.title+'</td>',                                  
											'<td><div data-role="controlgroup" data-type="horizontal" data-mini="true" class="ui-btn-right" style="float:right;">',
												'<a class="opacity-btn" id ="opacity-btn-'+this.layerid+'" name="'+this.layerid+'" href="#" data-role="button" data-iconpos="notext" data-icon="gear" data-theme="d">Opacité de la couche</a>',
												'<a class="metadata-btn" id="metadata-btn-'+this.layerid+'" name="'+this.layerid+'" href="#" data-role="button" data-iconpos="notext" data-icon="grid" data-theme="d">Plus d\'information sur cette couche de données</a>',												
											'</div></td>',		
										 '</tr>',
									'</tbody>',
							 '</table>',
						'</h3>',						
						'<p><form class="layer-display" title="Afficher/masquer cette couche">',
						'<input data-theme="d" class="togglelayer" type="checkbox"  data-mini="true" name="'+this.layerid+'" id="checkbox-mini-'+this.layerid+'"',
							(this.checked===true)?' checked="checked"':'',
						'>',
						'<label for="checkbox-mini-'+this.layerid+'">',
							'<table style="width:100%;" >',
								'<tbody>',
									'<tr>',
										'<td><img src="'+this.legendurl+'"></td>',
										(this.queryable===true)?'<td><img class="infoicon" src="img/info/info.png"></td>':'',
									'</tr>',                            
								'</tbody>',
							'</table>',                
						'</label>',
						'</form></p>',						
						'</a>',             
					'</li>'].join( " ");
}