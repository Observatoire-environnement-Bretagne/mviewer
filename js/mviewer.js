/*
 *
 * This file is part of mviewer
 *
 * mviewer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with mviewer.  If not, see <http://www.gnu.org/licenses/>.
 */

mviewer = (function () {
    /*
     * Private
     */

    proj4.defs("EPSG:2154",
        "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 " +
        "+units=m +no_defs");

    /**
     * Property: _proxy
     * Ajax proxy to use for crossdomain requests
     * It could be georchestra security-proxy
     */

    var _proxy = "";

    /**
     * Property: _authentification
     * Its possible behind georchestra security-proxy.
     * allows working with protected layers
     */

    var _authentification = {enabled:false};

    /**
     * Property: _ajaxURL
     *
     */

    var _ajaxURL = function (url) {
        // relative path
        if (url.indexOf('http')!=0) {
            return url;
        }
        // same domain
        else if (url.indexOf(location.protocol + '//' + location.host)===0) {
            return url;
        }
        else {
            if (_proxy) {
                return  _proxy + encodeURIComponent(url);
            } else {
                return url;
            }
        }
    };

    /**
     * Property: _options
     * XML. The application configuration
     */

    var _options = null;

    /**
     * Property: _map
     * {ol.Map} The map
     */

    var _map = null;

    /**
     * Property: _crossorigin
     * The crossOrigin attribute for loaded images. Note that you must provide a crossOrigin value
     * if you want to access pixel data with the Canvas renderer for export png for example.
     * See https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image for more detail.
     */

    var _crossorigin = null;

    var _print = false;

    var _showhelp_startup = false;

    var _captureCoordinates = false;

    var _toggleAllLayersFromTheme = false;

    /**
     * Property: _projection
     * {ol.projection} The map projection
     */

    var _projection = null;

    /**
     * Property: _mapOptions
     * {Object}  hash of map options
     */

    var _mapOptions = null;

    /**
     * Property: _extent
     * {OpenLayers.Bounds} The initial extent of the map
     */

    var _extent = null;

    /**
     * Property: _center
     *
     */

    var _center = null;
    /**
      * Property: _rotation
      *
      */

    var _rotation = false;

    /**
     * Property: _backgroundLayers
     * Array -  of  OpenLayers.Layer
     */

    var _backgroundLayers = [];

    /**
     * Property: _overLayers
     * {object} hash of all overlay Layers (static)
     */

    var _overLayers = {};

    /**
     * Property: _vectorLayers
     * Array of {ol.layer.Vector} .
     */

    var _vectorLayers = [];

    /**
     * Property: _scaledDependantLayers
     * Array of {OpenLayers.Layers.WMS} .
     */

    var _scaledDependantLayers = [];

    var _scaledDependantLayersLegend = [];

    /**
     * Property: _themes
     * {object} hash of all overlay Layers (for each sub theme) - static.
     */

    var _themes = null;


    /**
     * Property: _overlay
     */

    var _overlay = null;

    /**
     * Property: _olsCompletionUrl
     * String. The OpenLs url used by the geocode control
     */

    var _olsCompletionUrl = null;

    /**
     * Property: _olsCompletionType
     * String. The service type used by the geocode control (geoportail or ban)
     */

    var _olsCompletionType = null;

    /**
     * Property: _marker
     * marker used to locate features on the map.
     * @type {ol.Overlay}
     */

    var _marker = null;

    var _topLayer = false;

    /**
     * Property: renderer
     * @type {ol.Renderer}
     */

    var _renderer = 'canvas';

    /**
     * Property: _sourceOverlay
     * @type {ol.source.Vector}
     * Used to highlight vector features
     */

    var _sourceOverlay;

    /**
     * Property: _overlayFeatureLayer
     * @type {ol.layer.Vector}
     * Used to highlight vector features
     */

    var _overlayFeatureLayer = false;


    /**
     * Property: _geoloc
     * Bool. Activate geolocalisation in the map
     */

    var _geoloc = false;

    /**
     * _message Show message method.
     * @param {String} msg
     */

    var _message = function (msg, cls) {
        var item = $(['<div class="alert '+cls+' alert-dismissible" role="alert">',
            '<button type="button" class="close" data-dismiss="alert" aria-label="Close">',
            '<span aria-hidden="true">&times;</span></button>',
            msg,
            '</div>'].join (""));
            $("#alerts-zone").append(item);
    };

    var _removeLayer = function (layername) {
        $( "[data-layerid='"+layername+"']").remove();
        _map.removeLayer(_overLayers[layername].layer);
        delete _overLayers[layername];
    };

    var _getlegendurl = function (layer, scale) {
        var sld = "";
        var legendUrl = "";
        if (layer.sld) {
            sld = '&SLD=' + encodeURIComponent(layer.sld);
        }
        if (layer.legendurl && layer.styles && (layer.styles.split(",").length === 1)) {
            legendUrl = layer.legendurl;
        } else {
            legendUrl = layer.url + '?service=WMS&Version=1.3.0&request=GetLegendGraphic&SLD_VERSION=1.1.0'+
            '&format=image%2Fpng&width=30&height=20&layer=' + layer.layername + '&style=' + layer.style + sld+
            '&legend_options=fontName:Open%20Sans;fontAntiAliasing:true;fontColor:0x777777;fontSize:10.5;dpi:96&TRANSPARENT=true';
        }
        if (layer.dynamiclegend) {
            if (!scale) {
                scale = _calculateScale(_map.getView().getResolution());
            }
            legendUrl = legendUrl.split("&scale=")[0] += "&scale="+scale;
        }
        return legendUrl;
    };

    var _convertScale2Resolution = function (scale) {
         return scale * 0.28/1000;
    };

    /**
     * Geoloalisation
     * Private Method: _initGeolocation
     *
     */

    var _initGeolocation = function () {
        _geolocation = new ol.Geolocation({
            projection: _projection,
            trackingOptions: {
                enableHighAccuracy: true
            }
        });
        _sourceGeolocation = new ol.source.Vector();
        var layerposition = new ol.layer.Vector({
          source: _sourceGeolocation
        });
        _map.addLayer(layerposition);
    };

    /**
     * Private Method: initVectorOverlay
     * this layer is used to render ol.Feature in methods
     * - zoomToLocation
     */

    var _initVectorOverlay = function () {
        _sourceOverlay = new ol.source.Vector();
        _overlayFeatureLayer = new ol.layer.Vector({
            source: _sourceOverlay,
            style: mviewer.featureStyles.highlight
        });
        _overlayFeatureLayer.set('mviewerid', 'featureoverlay');
        _map.addLayer(_overlayFeatureLayer);
    };

    /**
     * Private Method: initTools
     * Tools can be set or unset. Only one tool can be enabled like a switch.
     * The default enabled tool is info (getFeatureInfo control)
     * Tools must have this methods : enable & disabled & init
     *
     */

    _initTools = function () {
        //GetFeatureInfo tool
        mviewer.tools.info = info;
        mviewer.tools.info.init(_map, _options, _captureCoordinates, _sourceOverlay);
        //Measure tool
        if ($(_options).find("application").attr("measuretools") === "true") {
            //Load measure moadule
            mviewer.tools.measure = measure;
            mviewer.tools.measure.init(_map);
        }
        //Activate GetFeatureInfo tool
        mviewer.setTool('info');
    };

    /**
     * Private Method: _initPanelsPopup
     *
     */

    var _initPanelsPopup = function () {
        if ($(_options).find("application").attr("help")) {
            $.ajax({
                url: $(_options).find("application").attr("help"),
                dataType: "text",
                success: function (html) {
                    $("#help .modal-body").append(html);
                }
            });
        }
    };

    /**
     * Private Method: _mapChange
     *
     *Parameter e - event
     */

    var _mapChange = function (e) {
        if ($("#sharepanel-popup").css("visibility") === "visible") {
            mviewer.setPermalink();
        }
        if (search.options.features && $("#searchfield").val()) {
           search.sendElasticsearchRequest($("#searchfield").val());
        }
    };

    /**
     * Private Method: _calculateScale
     *
     * Parameter res - resolution
     */

    var _calculateScale = function (res) {
        var ppi = 25.4/0.28;
        return res*ppi/0.0254;
    };

    /**
     * Private Method: _mapZoomChange
     *
     *Parameter e - event
     */

    var _mapZoomChange = function (e) {
        var resolution = e.target.getResolution();
        var scale = _calculateScale(resolution);
        _updateLayersScaleDependancy(scale);
        _updateLegendsScaleDependancy(scale);
    };

    /**
     * Private Method: _getLayerByName
     *
     * Parameter name - layer name
     */

    var _getLayerByName = function (name) {
        return $.grep(_map.getLayers().getArray(), function(layer, i) { return layer.get('name') === name; })[0];
    };

    var _processLayer = function (oLayer, l) {
        oLayer.layer = l;
        l.setVisible(oLayer.checked);
        l.setOpacity(oLayer.opacity);
        if (oLayer.scale && oLayer.scale.max) { l.setMaxResolution(_convertScale2Resolution(oLayer.scale.max)); }
        if (oLayer.scale && oLayer.scale.min) { l.setMinResolution(_convertScale2Resolution(oLayer.scale.min)); }
        l.set('name', oLayer.name);
        l.set('mviewerid', oLayer.id);

        if (oLayer.searchable) {
            search.processSearchableLayer(oLayer);
        }
        if (oLayer.scale) {
            _scaledDependantLayers.push(oLayer);
        }
        if (oLayer.dynamiclegend) {
            _scaledDependantLayersLegend.push(oLayer);
        }
        _overLayers[oLayer.id] = oLayer;

        if (oLayer.metadatacsw && oLayer.metadatacsw.search("http")>=0) {
            $.ajax({
                dataType: "xml",
                layer: oLayer.id,
                url:  _ajaxURL(oLayer.metadatacsw),
                success: function (result) {
                    var summary = "";
                    if ($(result).find("dct\\:abstract, abstract").length > 0) {
                        summary = '<p>'+ $(result).find("dct\\:abstract, abstract").text()+ '</p>';
                    } else {
                        summary = '<p>'+$(result).find("gmd\\:identificationInfo, identificationInfo")
                            .find("gmd\\:MD_DataIdentification,  MD_DataIdentification")
                            .find("gmd\\:abstract, abstract").find("gco\\:CharacterString, CharacterString").text()+ '</p>';
                    }
                    if (_overLayers[this.layer].metadata) {
                        summary += '<a href="'+_overLayers[this.layer].metadata+'" target="_blank">En savoir plus</a>';
                    }
                    _overLayers[this.layer].summary = summary;
                    //update visible layers on the map
                    $('#'+this.layer+'-layer-summary').attr("data-content", summary);
                }
            });
        }
        _map.addLayer(l);
    };


    /**
     * Private Method: _initDataList
     *
     * Parameter
     */

    var _initDataList = function () {
        var htmlListGroup = '';
        var reverse_themes = [];
        var crossorigin = '';
        $.each(_themes, function (id, theme) {
            reverse_themes.push(theme);
        });

        $.each(reverse_themes.reverse(), function (id, theme) {
            var reverse_layers = [];
            var groups = [];
            var classes = [];
            var view = {
                id:theme.id,
                name: theme.name,
                icon: theme.icon,
                layers:false,
                groups: false,
                toggleAllLayers: false,
                cls: ""
            };
             if (_toggleAllLayersFromTheme) {
                 view.toggleAllLayers = true;
                 classes.push("empty");
             }
            //GROUPS
            if (_themes[theme.id].groups) {
                classes.push("level-1");
                $.each(_themes[theme.id].groups, function (id, group) {
                    var grp = {title: group.name, layers: [] };
                    $.each(group.layers, function (id, layer) {
                        grp.layers.unshift(layer);
                    });
                    groups.push(grp);
                });
                view.groups = groups;
                view.cls = classes.join(" ");
            //NO GROUPS
            } else {
                 $.each(_themes[theme.id].layers, function (id, layer) {
                    reverse_layers.push(layer);
                });
                view.layers = reverse_layers.reverse();
                view.cls = classes.join(" ");
            }
            htmlListGroup += Mustache.render(mviewer.templates.theme, view);
        });
        var panelMini = $(_options).find("themes").attr("mini");
        if (panelMini && (panelMini === 'true')) {
            mviewer.toggleMenu(false);
            mviewer.toggleLegend(false);
        }
        $("#menu").html(htmlListGroup);
        initMenu();
        // Open theme item if set to collapsed=false
        var expanded_theme = $(_options).find('theme[collapsed="false"]').attr("id");
        $("#theme-layers-"+expanded_theme+">a").click();
        //Add remove and add layers button on them
        if (_toggleAllLayersFromTheme) {
            $(".toggle-theme-layers").on("click",mviewer.toggleAllThemeLayers);
        }
    };

    var _setLayerScaleStatus = function (layer, scale) {
        if (layer.scale) {
            var legendUrl = _getlegendurl(layer);
            if (scale > layer.scale.min && scale <= layer.scale.max) {
                $('#legend-'+layer.id).attr("src",legendUrl);
                $('#legend-'+layer.id).closest("li").removeClass("glyphicon mv-invisible");
            } else {
                $('#legend-'+layer.id).attr("src","img/invisible.png");
                $('#legend-'+layer.id).closest("li").addClass("glyphicon mv-invisible");
            }
        }
    };

    var _setLayerLegend = function (layer, scale) {
        if (layer.dynamiclegend) {
            var legendUrl = _getlegendurl(layer,scale);
            $('#legend-'+layer.id).attr("src",legendUrl);
        }
    };

    var _updateLayersScaleDependancy = function (scale) {
        $.each( _scaledDependantLayers, function (i, item) {
            _setLayerScaleStatus(item, scale);
        });
    };

    var _updateLegendsScaleDependancy = function (scale) {
        $.each( _scaledDependantLayersLegend, function (i, item) {
            _setLayerLegend(item, scale);
        });
    };

    var _setThemeStatus = function (id, prop) {
        var theme = $('#theme-layers-' + id);
        if (!prop) {
            prop = _getThemeStatus(id);
        }
        switch (prop.status) {
            case "empty":
                theme.removeClass("half full").addClass(prop.status);
                break;
            case "full":
                theme.removeClass("half empty").addClass(prop.status);
                break;
            case "half":
                theme.removeClass("empty full").addClass(prop.status);
                break;
        }
        theme.find(".toggle-theme-layers .badge").text([prop.visible, prop.all].join("/"));
    };

    _getThemeStatus = function (id) {
        var theme = $('#theme-layers-' + id);
        var nbLayers = theme.find("input").length;
        var visLayers = theme.find("input[value='true']").length;
        var status = "";
        if (visLayers === 0 ) {
            status = "empty";
        } else if (visLayers === nbLayers ){
            status = "full";
        } else {
            status = "half";
        }
        return {"visible" : visLayers, "all": nbLayers, "status": status};
    };

    /**
     * Method: _createBaseLayer
     * Create an {OpenLayers.Layer}.OSM|WMTS|WMS
     *
     * Parameters:
     * params - [ xml ] a baselayer node    present in config.xml.
     */

    var _createBaseLayer = function (params) {
        var l;
        switch (params.attr("type")) {
        case "fake":
            var l = new ol.layer.Layer({});
            _backgroundLayers.push(l);
            l.set('name', params.attr("label"));
            l.set('blid', params.attr("id"));
            break;
        case "WMS":
            l =  new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    url: params.attr("url"),
                    crossOrigin: _crossorigin,
                    maxZoom: params.attr("maxzoom") || 18,
                    params: {
                        'LAYERS': params.attr("layers"),
                        'VERSION': '1.1.1',
                        'FORMAT': params.attr("format"),
                        'TRANSPARENT': false,
                        'TILED': true
                    },
                    attributions: [new ol.Attribution({
                        html: params.attr("attribution")
                    })]
                }),
                visible: false
            });
            l.set('name', params.attr("label"));
            l.set('blid', params.attr("id"));

            _backgroundLayers.push(l);
            _map.addLayer(l);
            break;
        case "WMTS":
            if (params.attr("fromcapacity") == "false") {
                var matrixset = params.attr("matrixset");
                var projectionExtent = _projection.getExtent();
                l = new ol.layer.Tile({
                    source: new ol.source.WMTS({
                        url:  params.attr("url"),
                        crossOrigin: _crossorigin,
                        layer: params.attr("layers"),
                        matrixSet: matrixset,
                        style: params.attr("style"),
                        format: params.attr('format'),
                        attributions: [new ol.Attribution({html:params.attr("attribution")})],
                        projection: _projection,
                        tileGrid: new ol.tilegrid.WMTS({
                            origin: ol.extent.getTopLeft(projectionExtent),
                            resolutions: utils.getWMTSTileResolutions(matrixset),
                            matrixIds: utils.getWMTSTileMatrix(matrixset)
                        })
                    })
                });
                l.setVisible(false);
                l.set('name', params.attr("label"));
                l.set('blid', params.attr("id"));
                _map.addLayer(l);
                _backgroundLayers.push(l);
            }
            else {
                $.ajax({
                    url:_ajaxURL(params.attr("url")),
                    dataType: "xml",
                    data: {
                        SERVICE: "WMTS",
                        VERSION: "1.0.0",
                        REQUEST: "GetCapabilities"
                    },
                    success: function (xml) {
                        var getCapabilitiesResult = (new ol.format.WMTSCapabilities()).read(xml);
                        var WMTSOptions = ol.source.WMTS.optionsFromCapabilities( getCapabilitiesResult, {
                            layer: params.attr("layers"),
                            matrixSet: params.attr("matrixset"),
                            format: params.attr('format'),
                            style: params.attr("style")
                        });
                        WMTSOptions.attributions = [new ol.Attribution({html:params.attr("attribution")})];
                        l = new ol.layer.Tile({ source: new ol.source.WMTS(WMTSOptions) });
                        l.set('name', params.attr("label"));
                        l.set('blid', params.attr("id"));
                        _map.getLayers().insertAt(0,l);
                        _backgroundLayers.push(l);
                        if( params.attr("visible") == 'true' ) {
                            l.setVisible(true);
                        } else {
                            l.setVisible(false);
                        }
                    }
                });
            }
            break;

        case "OSM":
            l = new ol.layer.Tile({
                source: new ol.source.OSM({
                    url: params.attr("url"),
                    crossOrigin: 'anonymous',
                    maxZoom: params.attr("maxzoom") || 18,
                    attributions: [new ol.Attribution({
                        html: params.attr("attribution")
                    })]
                }),
                visible: false
            });
            l.set('name', params.attr("label"));
            l.set('blid', params.attr("id"));
            _backgroundLayers.push(l);
            _map.addLayer(l);
            break;
        }
    };

    /**
     * Private Method: _getVisibleOverLayers
     *
     */

    var _getVisibleOverLayers = function () {
        var layers = [];
        $.each(_overLayers, function (i, item) {
            if (item.layer.getVisible()) {
                layers.push(item.name);
            }
        });
        return layers.join(",");
    };

    /**
     * Private Method: _setVisibleOverLayers
     *
     */

    var _setVisibleOverLayers = function (lst) {
        var layers = decodeURIComponent(lst).split(",");
        for (var i = 0; i < layers.length; i++) {
            var l = _getLayerByName(layers[i]);
            (l.src)?l.src.setVisible(true):l.setVisible(true);
        }
        _overwiteThemeProperties(layers);
    };

    /**
     * Private Method: _showCheckedLayers
     *
     * Parameter
     */

    var _showCheckedLayers = function () {
        var checkedLayers = $.map(_overLayers, function(layer, index) {
            if (layer.checked) {
                return layer;
            }
        });
        $.each( checkedLayers, function ( index, layer) {
            if (layer) {
                var l = layer.layer;
                if (l && $(".list-group-item.mv-layer-details[data-layerid='"+layer.id+"']").length === 0) {
                    (l.src)?l.src.setVisible(true):l.setVisible(true);
                    mviewer.addLayer(layer);
                }
            }
        });
    };

    /**
     * Private Method: _overwiteThemeProperties
     *
     * Parameter: layers (Array of strings)
     */

    var _overwiteThemeProperties = function (layers) {
        $.each(_themes, function (i, theme) {
            $.each(theme.layers, function (j, l) {
                if (layers.indexOf(l.name) != -1) {
                    l.checked = true;
                    l.visiblebydefault = true;
                    var li = $(".mv-nav-item[data-layerid='"+l.id+"']");
                    mviewer.toggleLayer(li);
                } else {
                    l.checked = false;
                    l.layer.setVisible(false);
                    l.visiblebydefault = false;
                }
            });
             $.each(theme.groups, function (g, group) {
                 $.each(group.layers, function (i, l) {
                    if (layers.indexOf(l.name) != -1) {
                        l.checked = true;
                        l.visiblebydefault = true;
                        var li = $(".mv-nav-item[data-layerid='"+l.id+"']");
                        mviewer.toggleLayer(li);
                    } else {
                        l.checked = false;
                        l.layer.setVisible(false);
                        l.visiblebydefault = false;
                    }
                });
             });
        });
    };

    /**
     * Private Method:  parseWMCResponse
     *
     */

    var _parseWMCResponse = function (response, wmcid) {
        var wmc = $('ViewContext', response);
        var wmc_extent = {};
        wmc_extent.srs=$(wmc).find('General > BoundingBox').attr('SRS');
        wmc_extent.minx = parseInt($(wmc).find('General > BoundingBox').attr('minx'));
        wmc_extent.miny = parseInt($(wmc).find('General > BoundingBox').attr('miny'));
        wmc_extent.maxx = parseInt($(wmc).find('General > BoundingBox').attr('maxx'));
        wmc_extent.maxy = parseInt($(wmc).find('General > BoundingBox').attr('maxy'));
        var map_extent = ol.proj.transformExtent([wmc_extent.minx, wmc_extent.miny, wmc_extent.maxx,
            wmc_extent.maxy], wmc_extent.srs, _projection.getCode());
        var title = $(wmc).find('General > Title').text() ||  $(wmc).attr('id');
        var themeLayers = {};
        var layerRank = 0 ;
        $(wmc).find('LayerList > Layer').each(function() {
            layerRank+=1;
            // we only consider queryable layers
            if ($(this).attr('queryable')=='1') {
                var oLayer = {};
                oLayer.checked = ($(this).attr('hidden')==='0')?true:false;
                oLayer.id = $(this).children('Name').text();
                oLayer.rank = layerRank;
                oLayer.infospanel = "right-panel";
                oLayer.layerid = $(this).children('Name').text();
                oLayer.layername = oLayer.id;
                oLayer.name = $(this).children('Title').text();
                oLayer.title = $(this).children('Title').text();
                oLayer.attribution = $(this).find("attribution").find("Title").text() || "";
                oLayer.metadata = $(this).find('MetadataURL > OnlineResource').attr('xlink:href');
                //fixme
                if (oLayer.metadata && oLayer.metadata.search('geonetwork') > 1) {
                    var mdid = oLayer.metadata.split('uuid=')[1];
                    oLayer.metadatacsw = oLayer.metadata.substring(0,oLayer.metadata.search('geonetwork')) +
                        'geonetwork/srv/eng/csw?SERVICE=CSW&VERSION=2.0.2&REQUEST=GetRecordById&elementSetName=full&ID=' +
                        mdid;
                }
                oLayer.style = $(this).find("StyleList  > Style[current='1'] > Name").text();
                oLayer.url = $(this).find('Server > OnlineResource').attr('xlink:href');
                oLayer.queryable = true;
                oLayer.infoformat = 'text/html';
                oLayer.format = $(this).find("FormatList  > Format[current='1']").text();
                oLayer.visiblebydefault = oLayer.checked;
                oLayer.tiled = false;
                //oLayer.ns = (oLayer.id.split(':').length > 0) ? oLayer.id.split(':')[0] : null;
                oLayer.legendurl = _getlegendurl(oLayer);
                oLayer.opacity = parseFloat($(this).find("opacity").text() || "1");
                var minscale = parseFloat($(this).find("MinScaleDenominator").text());
                var maxscale = parseFloat($(this).find("MaxScaleDenominator").text());
                if (!isNaN(minscale) || !isNaN(maxscale)) {
                    oLayer.scale = {};
                    if (!isNaN(minscale)) {
                        oLayer.scale.min = minscale;
                    }
                    if (!isNaN(maxscale)) {
                        oLayer.scale.max = maxscale;
                    }
                }

                oLayer.theme = wmcid;
                console.log("wmc", oLayer);
                themeLayers[oLayer.id] = oLayer;
                var l = new ol.layer.Image({
                    source: new ol.source.ImageWMS({
                        url: oLayer.url,
                        crossOrigin: _crossorigin,
                        params: {
                            'LAYERS': oLayer.id,
                            'STYLES':oLayer.style,
                            'FORMAT': 'image/png',
                            'TRANSPARENT': true
                        }
                    })
                });
                l.setVisible(oLayer.checked);
                l.setOpacity(oLayer.opacity);
                if (oLayer.scale && oLayer.scale.max) { l.setMaxResolution(_convertScale2Resolution(oLayer.scale.max)); }
                if (oLayer.scale && oLayer.scale.min) { l.setMinResolution(_convertScale2Resolution(oLayer.scale.min)); }
                l.set('name', oLayer.name);
                l.set('mviewerid', oLayer.id);
                themeLayers[oLayer.id].layer = l;
                _overLayers[oLayer.id] = themeLayers[oLayer.id];
                info.addQueryableLayer(_overLayers[oLayer.id]);
                if (oLayer.scale) {
                    _scaledDependantLayers.push(oLayer);
                }
                _map.addLayer(l);
            }

        });
        return {title: title, extent:map_extent, layers:themeLayers};
    };

    var _flash = function (feature, source) {
        var duration = 1000;
        var start = new Date().getTime();
        var listenerKey;

        function animate(event) {
            var vectorContext = event.vectorContext;
            var frameState = event.frameState;
            var flashGeom = feature.getGeometry().clone();
            var elapsed = frameState.time - start;
            var elapsedRatio = elapsed / duration;
            // radius will be 5 at start and 30 at end.
            var radius = ol.easing.easeOut(elapsedRatio) * 25;
            var opacity = ol.easing.easeOut(1 - elapsedRatio);

            var flashStyle = new ol.style.Style({
                image: new ol.style.Circle({
                    radius: radius,
                    snapToPixel: false,
                    stroke: new ol.style.Stroke({
                        color: 'rgba(255, 0, 0, ' + opacity + ')',
                        width: 3,
                        opacity: opacity
                    })
                })
            });
            vectorContext.setStyle(flashStyle);
            vectorContext.drawGeometry(flashGeom);
            if (elapsed > duration) {
                ol.Observable.unByKey(listenerKey);
                source.removeFeature(feature);
                return;
            }
            // tell OL to continue postcompose animation
            _map.render();
        }
        listenerKey = _map.on('postcompose', animate);
    };

    var _calculateTicksPositions = function (values) {
        var min = values[0];
        var max = values[values.length - 1];
        var interval = max - min;
        var positions = [0];
        for (var i = 1; i < values.length - 1; ++i) {
            var val = values[i];
            var pos = parseInt((val - min)/interval * 100);
            positions.push(pos);
        }
        positions.push(100);
        return positions;
    };

    var _createPseudoTicks = function (values) {
        var ticks = [];
        for (var i = 0; i <= values.length - 1; ++i) {
            ticks.push(i);
        }
        return ticks;
    };

        /**
         * Private Method: _getLonLatZfromGeometry
         *
         */

    var _getLonLatZfromGeometry = function (geometry, proj, maxzoom) {
        var xyz = {};
        if (geometry.getType() === "Point") {
            var coordinates = geometry.getCoordinates();
            xyz = { lon: coordinates[0],
                    lat: coordinates[1],
                    zoom: maxzoom || 15
            };
        } else {
            var extent = geometry.getExtent();
            var projExtent = ol.proj.transformExtent(extent, proj, _projection.getCode());
            var resolution = _map.getView().getResolutionForExtent(projExtent, _map.getSize());
            var zoom = parseInt(_map.getView().getZoomForResolution(resolution));
            if (maxzoom && zoom > maxzoom) { zoom = maxzoom; }
            var center = ol.proj.transform(ol.extent.getCenter(extent),proj, 'EPSG:4326');
            xyz = { lon: center[0],
                    lat: center[1],
                    zoom: zoom
            };
        }
        return xyz;
    };

    /*
     * Public
     */

    return {

        flash:  function (proj,x,y) {
            var source, vector;
            var vectorLayer = _getLayerByName("flash");
            if (!vectorLayer) {
                source = new ol.source.Vector({
                    wrapX: false,
                });
                vector = new ol.layer.Vector({
                    source: source,
                    style: mviewer.featureStyles.crossStyle
                });
                vector.set('name', "flash");
                _map.addLayer(vector);
                source.on('addfeature', function(e) {
                    _flash(e.feature, source);
                });
            } else {
                vector = vectorLayer;
                source = vectorLayer.getSource();
            }
            var geom = new ol.geom.Point(ol.proj.transform([x, y],
                proj, _map.getView().getProjection().getCode()));
            var feature = new ol.Feature(geom);
            source.addFeature(feature);
        },

        /**
         * Public Method: setTool
         *
         */

        setTool: function (tool, option) {
            //Deactivate active Tool if new tool is different
            if (mviewer.tools.activeTool && mviewer.tools[mviewer.tools.activeTool]) {
                mviewer.tools[mviewer.tools.activeTool].disable();
            }
            //Activate new tool
            if (mviewer.tools[tool]) {
                mviewer.tools[tool].enable(option);
                mviewer.tools.activeTool = tool;
            }
        },

        /**
         * Public Method: setTool
         *
         */

        unsetTool: function (tool) {
            //Deactivate active Tool
            if (mviewer.tools.activeTool === tool  && mviewer.tools[tool]) {
                mviewer.tools[tool].disable();
            }
            //activate getFeatureInfo
            if (tool !== 'info') {
                mviewer.tools.info.enable();
                mviewer.tools.activeTool = 'info';
            }
        },

        /**
         * Public Method: zoomOut
         *
         */

        zoomOut: function () {
           var v = _map.getView();
           v.animate({zoom: v.getZoom() - 1});
        },

        /**
         * Public Method: zoomIn
         *
         */

        zoomIn: function () {
            var v = _map.getView();
            v.animate({zoom: v.getZoom() + 1});
        },

        /**
         * Public Method: zoomToInitialExtent
         *
         */

        zoomToInitialExtent: function () {
           _map.getView().setCenter(_center);
           _map.getView().setZoom(_zoom);
        },

        /**
         * Public Method: getActiveBaseLayer
         *
         */

        getActiveBaseLayer: function () {
            var result = null;
            for (var i = 0; i < _backgroundLayers.length; i += 1) {
                var l = _backgroundLayers[i];
                if (l.getVisible()) {
                    result = l.get('blid');
                    break;
                }
            }
            return result;
        },

        /**
         * Public Method: setActiveBaseLayer
         *
         */

        setBaseLayer: function (baseLayerId) {
            if ($(".mini").length ==1 && $(".no-active").length > 0) {
                mviewer.bgtoogle();
                return;
            }
            var nexid = null;
            for (var i = 0; i < _backgroundLayers.length; i += 1) {
                var l = _backgroundLayers[i];
                if (l.get('blid') === baseLayerId) {
                    l.setVisible(true);
                    nexid=(i+1)%_backgroundLayers.length;
                 } else {
                    l.setVisible(false);
                 }
            }
            if ($(_options).find("baselayers").attr("style") === 'default') {
                //get the next thumb
                var thumb = $(_options).find('baselayer[id="'+_backgroundLayers[nexid].get('blid')+'"]').attr("thumbgallery");
                var title = $(_options).find('baselayer[id="'+_backgroundLayers[nexid].get('blid')+'"]').attr("label");
                $("#backgroundlayersbtn").css("background-image", 'url("'+thumb+'")');
                $("#backgroundlayersbtn").attr("title", title);
                $("#backgroundlayersbtn").tooltip('destroy').tooltip({
                    placement: 'left',
                    trigger: 'hover',
                    html: true,
                    container: 'body',
                    template: mviewer.templates.tooltip
                 });
            }
            $.each(_backgroundLayers, function (id, layer) {
                var opt = $(_options).find("baselayers").attr("style");
                var elem = (opt === "gallery") ? $('#' + layer.get('blid') + '_btn')
                    .closest('li') : $('#' + layer.get('blid') + '_btn');
                if (layer.getVisible()) {
                    elem.removeClass("no-active");
                    elem.addClass("active");
                } else {
                    elem.removeClass("active");
                    elem.addClass("no-active");
                }
            });
            mviewer.bgtoogle();
        },

        /**
         * Public Method: changeLayerOpacity
         *
         */

        changeLayerOpacity: function (id, value) {
            _overLayers[id].layer.setOpacity(value);
            _overLayers[id].opacity = parseFloat(value);
        },

        /**
         * Public Method: getLayerOpacity
         *
         */

        getLayerOpacity: function (id) {
            return _overLayers[id].layer.getOpacity();
        },

        bgtoogle: function () {
            $("#backgroundlayerstoolbar-gallery .no-active").toggle();
            $("#backgroundlayerstoolbar-gallery .bglt-btn").toggleClass("mini");
        },

        /**
         * Public Method: getLayerMetadata
         *
         */

        getLayerMetadata: function (id) {
            return {url:_overLayers[id].metadata, csw:_overLayers[id].metadatacsw};
        },

        /**
         * Public Method: toggleOverLayer
         *
         */

        toggleOverLayer: function (id) {
            _overLayers[id].checked = !_overLayers[id].checked;
            if (_overLayers[id].checked) {
                _overLayers[id].layer.setVisible(true);
            } else {
                _overLayers[id].layer.setVisible(false);
            }
        },

        reorderLayer: function (layer, newIndex) {
            var layers = _map.getLayers().getArray();
            var oldIndex = layers.indexOf(layer);
            layers.splice(newIndex, 0, layers.splice(oldIndex, 1)[0]);
            _map.render();

        },

        orderLayer: function (actionMove) {
            if (actionMove.layerRef) {
                var layers = _map.getLayers().getArray();
                var layer = _overLayers[actionMove.layerName];
                var layerRef = _overLayers[actionMove.layerRef];
                var oldIndex = layers.indexOf(layer.layer);
                var refIndex = layers.indexOf(layerRef.layer);
                var newIndex = null;
                if (actionMove.action === "up") {
                    newIndex = refIndex +1;
                } else {
                    newIndex = refIndex -1;
                }
                layers.splice(newIndex, 0, layers.splice(oldIndex, 1)[0]);
                //put overlayFeatureLayer on the top of the map
                if (_overlayFeatureLayer) {
                    _map.removeLayer(_overlayFeatureLayer);
                    _map.getLayers().setAt(_map.getLayers().getArray().length, _overlayFeatureLayer);
                    //_map.getLayers().forEach(function(layer,id) {console.log(layer.get('mviewerid'))});
                }
                _map.render();
            }
        },

        /**
         * Public Method: setPermalink
         *
         */

        setPermalink: function () {
            var c = _map.getView().getCenter();
            var linkParams = {};
            if (!config.wmc){
                linkParams.x = encodeURIComponent(Math.round(c[0]));
                linkParams.y = encodeURIComponent(Math.round(c[1]));
                linkParams.z = encodeURIComponent(_map.getView().getZoom());
                linkParams.l = encodeURIComponent(_getVisibleOverLayers());
            }
            linkParams.lb = encodeURIComponent(this.getActiveBaseLayer());
            if (config.config) {
                linkParams.config = config.config;
            }
            if (config.wmc) {
                linkParams.wmc = config.wmc;
            }

            var url = window.location.href.split('?')[0].replace('#','') + '?' + $.param(linkParams);
            $("#permalinklink").attr('href',url).attr("target", "_blank");
            $("#permaqr").attr("src","http://chart.apis.google.com/chart?cht=qr&chs=140x140&chl=" + encodeURIComponent(url));
            return url;
        },

        /**
         * Public Method: getInitialExtent
         *
         */

        getInitialExtent: function () {
            return _extent;
        },

        /**
         * Public Method: getMap
         *
         */

        getMap: function () {
            return _map;
        },

        /**
         * Public Method: init
         *
         */

        init: function (xml) {
            utils.testConfiguration(xml);
            _options = xml;
            //Application customization (logo, title, helpfile) /
            var applicationOverride = $(xml).find("application");
            if (applicationOverride.attr("title")) {
                document.title = applicationOverride.attr("title");
                $(".mv-title").text(applicationOverride.attr("title"));
            }
            if ((applicationOverride.attr("stats") === "true" ) && applicationOverride.attr("statsurl")) {
                $.get(applicationOverride.attr("statsurl") +"?app=" + document.title);
            }
            if (applicationOverride.attr("logo")) {
                $(".mv-logo").attr("src", applicationOverride.attr("logo"));
            }
            if (applicationOverride.attr("showhelp") === "true" ) {
                _showhelp_startup = true;
            }
            if (applicationOverride.attr("coordinates") === "true" ) {
                _captureCoordinates = true;
            }
            if (applicationOverride.attr("togglealllayersfromtheme") === "true" ) {
                _toggleAllLayersFromTheme = true;
            }
            if (applicationOverride.attr("exportpng") === "true" ) {
                _crossorigin = "anonymous";
                $("#exportpng").show();
            } else {
                 $("#exportpng").remove();
            }
            if ((!applicationOverride.attr("mouseposition")) || (applicationOverride.attr("mouseposition")==="false")){
                $("#mouse-position").hide();
            }
            if (applicationOverride.attr("geoloc")==="true") {
                _geoloc = true;
            } else {
                 $("#geolocbtn").hide();
            }
            //map options
            var options = $(xml).find("mapoptions");
            _zoom = parseInt(options.attr("zoom")) || 8;
            if (options.attr("rotation") === "true" ) {
                _rotation = true;
            } else {
                 $("#northbtn").hide();
            }
            _center = options.attr("center").split(",").map(Number);
            //Projection
            switch (options.attr("projection")) {
                case "EPSG:3857":
                case "EPSG:4326":
                    _projection = ol.proj.get(options.attr("projection"));
                    break;

                default:
                    _projection = new ol.proj.Projection({
                        code: options.attr("projection"),
                        extent: options.attr("projextent").split(",").map(function(item) {return parseFloat(item);})
                    });
            }

            utils.initWMTSMatrixsets(_projection);

            var overlays = [];

            $("#popup-content").append('<div data-role="ui-content">' +
                '<p>Cliquer sur la carte afin de procéder à l\'interrogation des données</p></div>');


            _marker = new ol.Overlay({ positioning: 'bottom-center', element: $("#els_marker")[0], stopEvent: false})
            overlays.push(_marker);

            if (config.x && config.y && config.z) {
                _center =   [parseFloat(config.x), parseFloat(config.y)];
                _zoom = parseInt(config.z);
            }
            _map = new ol.Map({
                target: 'map',
                controls: [
                    //new ol.control.FullScreen(),
                    new ol.control.ScaleLine(),
                    new ol.control.Attribution({label: "\u00a9"}),
                    new ol.control.MousePosition({
                        projection: _projection.getCode(),
                        undefinedHTML: 'y , x',
                        className: 'custom-mouse-position',
                        target: document.getElementById('mouse-position'),
                        coordinateFormat: function(coordinate) {
                            let getCoord = ol.coordinate.toStringHDMS(ol.proj.transform(coordinate,
                                _projection.getCode(), 'EPSG:4326'));
                            let coordStr = getCoord.replace(/ /g,"").replace("N","N - ");
                            return coordStr;
                        }
                    }),
                ],
                overlays: overlays,
                renderer: _renderer,
                view: new ol.View({
                    projection: _projection,
                    maxZoom: options.attr("maxzoom") || 19,
                    center: _center,
                    enableRotation: _rotation,
                    zoom: _zoom
                })
            });
            _proxy = $(xml).find('proxy').attr("url");
            _authentification.enabled = $(xml).find('authentification').attr("enabled")=="true"?true:false;
            if (_authentification.enabled) {
                _authentification.url = $(xml).find('authentification').attr("url");
                _authentification.loginurl = $(xml).find('authentification').attr("loginurl");
                _authentification.logouturl = $(xml).find('authentification').attr("logouturl");
                $.ajax({
                    url: _authentification.url, success: function (response) {
                        //test georchestra proxy
                        if(response.proxy == "true") {
                            $("#login").show();
                            if (response.user !="") {
                                $("#login").attr("href",_authentification.logouturl);
                                $("#login").attr("title","Se déconnecter");
                                console.log("Bonjour " + response.user);
                            } else {
                                var url="";
                                if (location.search=="") {
                                    url=_authentification.loginurl;
                                } else {
                                    url=location.href  + _authentification.loginurl.replace("?","&");
                                }
                                $("#login").attr("href",url);
                            }
                        } else {
                            console.log(["Kartenn n'a pas détecté la présence du security-proxy georChestra.",
                                "L'accès aux couches protégées et à l'authentification n'est donc pas possible"].join("\n"));
                        }
                    }
                });
            }

            var bl = $(xml).find('baselayer');
            var th = $(xml).find('theme');
            //baselayertoolbar
            var baselayerControlStyle = $(xml).find('baselayers').attr("style");
            if (baselayerControlStyle === "gallery") {
                $("#backgroundlayerstoolbar-default").remove();
            } else {
                $("#backgroundlayerstoolbar-gallery").remove();
            }
            $(bl).each(function () {
                _createBaseLayer($(this));
                if (baselayerControlStyle === "gallery") {
                    $("#basemapslist").append(Mustache.render(mviewer.templates.backgroundLayerControlGallery, $.xml2json(this)));
                }
            });
            if (baselayerControlStyle === "gallery") {
                $("#basemapslist li").tooltip({
                    placement: 'left',
                    trigger: 'hover',
                    html: true,
                    container: 'body',
                    template: mviewer.templates.tooltip
                });
            }
            _themes = {};
            var themeLayers = {};
            if (config.wmc) {
                var reg=new RegExp("[,]+", "g");
                var wmcs=config.wmc.split(reg);
                for (var i=0; i<wmcs.length; i++) {
                    (function(key) {
                        var wmcid = "wmc"+key ;
                        $.ajax({
                            url:_ajaxURL(wmcs[key]),
                            dataType: "xml",
                            success: function (xml) {
                                var wmc = _parseWMCResponse(xml, wmcid);
                                _themes[wmcid] = {};
                                _themes[wmcid].collapsed = false;
                                _themes[wmcid].id = wmcid;
                                _themes[wmcid].layers = {};
                                _themes[wmcid].icon = "chevron-circle-right";
                                console.log ("adding "+wmc.title+" category");
                                _map.getView().fit(wmc.extent, { size: _map.getSize(),
                                    padding: [0, $("#sidebar-wrapper").width(), 0, 0]});
                                _themes[wmcid].layers = wmc.layers;
                                _themes[wmcid].name = wmc.title;
                                _initDataList();
                                _showCheckedLayers();
                            }
                        });
                    })(i);
                }
            } else {
                var themes = $(xml).find('theme');
                var layerRank = 0;
                var doublons = {};
                $(themes.get().reverse()).each(function () {
                    var themeid = $(this).attr("id");
                    var icon = "fa-lg fa-" + ($(this).attr("icon") || "globe");
                    _themes[themeid] = {};
                    _themes[themeid].id = themeid;
                    _themes[themeid].icon = icon;
                    _themes[themeid].name = $(this).attr("name");
                    _themes[themeid].groups = false;
                    // test group
                    if ($(this).find("group").length) {
                        var groups = $(this).find("group");
                        _themes[themeid].groups = {};
                        groups.each(function () {
                            _themes[themeid].groups[$(this).attr("id")] = {name: $(this).attr("name"), layers: {}};
                        });

                        }
                        _themes[themeid].layers = {};
                        var layersXml = $(this).find('layer');
                        $(layersXml.get().reverse()).each(function () {
                            layerRank+=1;
                            var layerId = $(this).attr("id");
                            console.log(themeid,layerId);
                            var secureLayer = ($(this).attr("secure") == "true") ? true : false;
                            if (secureLayer) {
                                $.ajax({
                                    dataType: "xml",
                                    layer: layerId,
                                    url:  _ajaxURL($(this).attr("url")+ "?REQUEST=GetCapabilities&SERVICE=WMS&VERSION=1.3.0"),
                                    success: function (result) {
                                        //Find layer in capabilities
                                        var name = this.layer;
                                        var layer = $(result).find('Layer>Name').filter(function() {
                                            return $(this).text() == name;
                                        });
                                        if (layer.length === 0) {
                                            //remove this layer from map and panel
                                            _removeLayer(this.layer);
                                        }
                                    }
                                });
                            }
                            var mvid;
                            var oLayer = {};
                            //var clean_ident = layerId.replace(':','__').split(",").join("_");
                            var clean_ident = layerId.replace(/:|,| |\./g,'');
                            if (_overLayers[clean_ident] ) {
                                doublons[clean_ident] += 1;
                                mvid = clean_ident + "dbl"+doublons[clean_ident];
                            } else {
                                mvid = clean_ident;
                                doublons[clean_ident] = 0;
                            }
                            oLayer.id = mvid;
                            oLayer.icon = icon;
                            oLayer.layername = layerId;
                            oLayer.type = $(this).attr("type") || "wms";
                            oLayer.theme = themeid;
                            oLayer.rank = layerRank;
                            oLayer.name = $(this).attr("name");
                            oLayer.title = $(this).attr("name");
                            oLayer.layerid = mvid;
                            oLayer.infospanel = $(this).attr("infopanel") ||'right-panel';
                            oLayer.featurecount = $(this).attr("featurecount");
                            //styles
                            if ($(this).attr("style") && $(this).attr("style") != "") {
                                var styles = $(this).attr("style").split(",");
                                oLayer.style = styles[0];
                                if (styles.length > 1) {
                                    oLayer.styles = styles.toString();
                                }
                            } else {
                               oLayer.style="";
                            }
                            if ($(this).attr("stylesalias") && $(this).attr("stylesalias") != "") {
                                oLayer.stylesalias = $(this).attr("stylesalias");
                            } else {
                                if (oLayer.styles) {
                                    oLayer.stylesalias = oLayer.styles;
                                }
                            }
                            oLayer.toplayer =  ($(this).attr("toplayer") == "true") ? true : false;
                            oLayer.draggable = true;
                            if (oLayer.toplayer) {
                                _topLayer = oLayer.id;
                                oLayer.draggable = false;
                            }
                            oLayer.sld = $(this).attr("sld") || null;
                            oLayer.filter = $(this).attr("filter");
                            oLayer.opacity = parseFloat($(this).attr("opacity") || "1");
                            oLayer.tooltip =  ($(this).attr("tooltip") == "true") ? true : false;
                            oLayer.tooltipenabled =  ($(this).attr("tooltipenabled") == "true") ? true : false;
                            oLayer.tooltipcontent = ($(this).attr("tooltipcontent")) ? $(this).attr("tooltipcontent") : '';
                            oLayer.expanded =  ($(this).attr("expanded") == "true") ? true : false;
                            oLayer.timefilter =  ($(this).attr("timefilter") &&
                                $(this).attr("timefilter") == "true") ? true : false;
                            if (oLayer.timefilter && $(this).attr("timeinterval")) {
                                oLayer.timeinterval = $(this).attr("timeinterval") || "day";
                            }
                            oLayer.timecontrol = $(this).attr("timecontrol") || "calendar";
                            if ($(this).attr("timevalues") && $(this).attr("timevalues").search(",")) {
                                oLayer.timevalues = $(this).attr("timevalues").split(",");
                            }
                            oLayer.timemin = $(this).attr("timemin") || new Date().getFullYear() -5;
                            oLayer.timemax = $(this).attr("timemax") || new Date().getFullYear();

                            oLayer.attributefilter =  ($(this).attr("attributefilter") &&
                                $(this).attr("attributefilter") == "true") ? true : false;
                            oLayer.attributefield = $(this).attr("attributefield");
                            oLayer.attributelabel = $(this).attr("attributelabel") || "Attributs";
                            if ($(this).attr("attributevalues") && $(this).attr("attributevalues").search(",")) {
                                oLayer.attributevalues = $(this).attr("attributevalues").split(",");
                            }
                            oLayer.attributestylesync =  ($(this).attr("attributestylesync") &&
                                $(this).attr("attributestylesync") == "true") ? true : false;
                            oLayer.attributefilterenabled =  ($(this).attr("attributefilterenabled") &&
                                $(this).attr("attributefilterenabled") == "true") ? true : false;
                            if (oLayer.attributestylesync && oLayer.attributefilterenabled && oLayer.attributevalues) {
                                oLayer.style = [oLayer.style.split('@')[0], '@',
                                oLayer.attributevalues[0].sansAccent().toLowerCase()].join("");
                            }
                            oLayer.customcontrol = ($(this).attr("customcontrol") == "true") ? true : false;
                            oLayer.customcontrolpath = $(this).attr("customcontrolpath") || "customcontrols";
                            oLayer.attribution = $(this).attr("attribution");
                            oLayer.metadata = $(this).attr("metadata");
                            oLayer.metadatacsw = $(this).attr("metadata-csw");
                            if (oLayer.metadata) {
                                oLayer.summary = '<a href="'+oLayer.metadata+'" target="_blank">En savoir plus</a>';
                            }
                            oLayer.url = $(this).attr("url");
                            //Mustache template
                            if ($(this).find("template") && $(this).find("template").attr("url")) {
                                $.get($(this).find("template").attr("url"), function(template) {
                                    oLayer.template = template;
                                });
                            } else if ($(this).find("template") && $(this).find("template").text()) {
                                oLayer.template = $(this).find("template").text();
                            } else {
                                oLayer.template = false;
                            }
                            oLayer.queryable = ($(this).attr("queryable") == "true") ? true : false;
                            oLayer.searchable = ($(this).attr("searchable") == "true") ? true : false;
                            if (oLayer.searchable) {
                                oLayer = search.configSearchableLayer(oLayer, this);
                            }
                            oLayer.infoformat = $(this).attr("infoformat");
                            oLayer.checked = ($(this).attr("visible") == "true") ? true : false;
                            oLayer.visiblebydefault = ($(this).attr("visible") == "true") ? true : false;
                            oLayer.tiled = ($(this).attr("tiled") == "true") ? true : false;
                            //oLayer.ns = ($(this).attr("namespace")) ? $(this).attr("namespace") : null;
                            oLayer.dynamiclegend = ($(this).attr("dynamiclegend") == "true") ? true : false;
                            oLayer.legendurl=($(this).attr("legendurl"))? $(this).attr("legendurl") : _getlegendurl(oLayer);
                            if (oLayer.legendurl === "false") {oLayer.legendurl = "";}
                            oLayer.useproxy = ($(this).attr("useproxy") == "true") ? true : false;
                            if ($(this).attr("fields")) {
                                oLayer.fields = $(this).attr("fields").split(",");
                                if ($(this).attr("aliases")) {
                                    oLayer.aliases = $(this).attr("aliases").split(",");
                                } else {
                                    oLayer.aliases = $(this).attr("fields").split(",");
                                }
                            }

                            if($(this).attr("iconsearch")){
                                oLayer.iconsearch=$(this).attr("iconsearch");
                            } else {
                                oLayer.iconsearch="img/star.svg";
                            }

                            if ($(this).attr("scalemin") || $(this).attr("scalemax")) {
                                oLayer.scale = {};
                                if ($(this).attr("scalemin")) {
                                    oLayer.scale.min = parseInt($(this).attr("scalemin"));
                                }
                                if ($(this).attr("scalemax")) {
                                    oLayer.scale.max = parseInt($(this).attr("scalemax"));
                                }
                            }
                            if (oLayer.customcontrol) {
                                var customcontrolpath = oLayer.customcontrolpath;
                                $.ajax({
                                    url: customcontrolpath + '/' + oLayer.id +'.js',
                                    layer: oLayer.id,
                                    dataType: "script",
                                    success : function (customLayer, textStatus, request) {
                                        $.ajax({
                                            url: customcontrolpath +'/'  +this.layer +'.html',
                                            layer: oLayer.id,
                                            dataType: "text",
                                            success: function (html) {
                                                mviewer.customControls[this.layer].form = html;
                                                if ($('.mv-layer-details[data-layerid="'+this.layer+'"]').length === 1) {
                                                    //append the existing mv-layers-details panel
                                                    $('.mv-layer-details[data-layerid="'+this.layer+'"]')
                                                        .find('.mv-custom-controls').append(html);
                                                    mviewer.customControls[this.layer].init();
                                                }
                                            }
                                        });
                                    },
                                    error: function () {
                                        alert( "error customControl" );
                                    }
                                });
                            }

                            themeLayers[oLayer.id] = oLayer;
                            var l= null;
                            if (oLayer.type === 'wms') {
                                var wms_params = {
                                    'LAYERS': $(this).attr("id"),
                                    'STYLES':(themeLayers[oLayer.id].style)? themeLayers[oLayer.id].style : '',
                                    'FORMAT': 'image/png',
                                    'TRANSPARENT': true
                                };
                                var source;
                                if (oLayer.filter) {
                                    wms_params['CQL_FILTER'] = oLayer.filter;
                                }
                                if (oLayer.attributefilter && oLayer.attributefilterenabled &&
                                    oLayer.attributevalues.length > 1) {
                                    wms_params['CQL_FILTER'] = oLayer.attributefield + "='" + oLayer.attributevalues[0] + "'";
                                }
                                if (oLayer.sld) {
                                    wms_params['SLD'] = oLayer.sld;
                                }
                                switch (oLayer.tiled) {
                                    case true:
                                        wms_params['TILED'] = true;
                                        source = new ol.source.TileWMS({
                                            url: $(this).attr("url"),
                                            crossOrigin: _crossorigin,
                                            tileLoadFunction: function (imageTile, src) {
                                                if (oLayer.useproxy) {
                                                    src = _proxy + encodeURIComponent(src);
                                                }
                                                imageTile.getImage().src = src;
                                            },
                                            params: wms_params
                                        });
                                        l = new ol.layer.Tile({
                                            source: source
                                        });
                                        break;
                                    case false:
                                        source = new ol.source.ImageWMS({
                                            url: $(this).attr("url"),
                                            crossOrigin: _crossorigin,
                                            imageLoadFunction: function (imageTile, src) {
                                                if (oLayer.useproxy) {
                                                    src = _proxy + encodeURIComponent(src);
                                                }
                                                imageTile.getImage().src = src;
                                            }, params: wms_params
                                        });
                                        l = new ol.layer.Image({
                                            source:source
                                        });
                                        break;
                                }
                                source.set('layerid', oLayer.layerid);
                                source.on('imageloadstart', function(event) {
                                    //console.log('imageloadstart event',event);
                                    $("#loading-" + event.target.get('layerid')).show();
                                });

                                source.on('imageloadend', function(event) {
                                    //console.log('imageloadend event',event);
                                    $("#loading-" + event.target.get('layerid')).hide();
                                });

                                source.on('imageloaderror', function(event) {
                                    //console.log('imageloaderror event',event);
                                    $("#loading-" + event.target.get('layerid')).hide();
                                });
                                source.on('tileloadstart', function(event) {
                                    //console.log('imageloadstart event',event);
                                    $("#loading-" + event.target.get('layerid')).show();
                                });

                                source.on('tileloadend', function(event) {
                                    //console.log('imageloadend event',event);
                                    $("#loading-" + event.target.get('layerid')).hide();
                                });

                                source.on('tileloaderror', function(event) {
                                    //console.log('imageloaderror event',event);
                                    $("#loading-" + event.target.get('layerid')).hide();
                                });
                                _processLayer(oLayer, l);
                            } //end wms
                            if (oLayer.type === 'geojson') {
                                l = new ol.layer.Vector({
                                    source: new ol.source.Vector({
                                        url: $(this).attr("url"),
                                        format: new ol.format.GeoJSON()
                                    })
                                });
                                if (oLayer.style && mviewer.featureStyles[oLayer.style]) {
                                    l.setStyle(mviewer.featureStyles[oLayer.style]);
                                }
                                _vectorLayers.push(l);
                                _processLayer(oLayer, l);
                            }// end geojson

                            if (oLayer.type === 'kml') {
                                l = new ol.layer.Vector({
                                    source: new ol.source.Vector({
                                        url: $(this).attr("url"),
                                        format: new ol.format.KML()
                                    })
                                });
                                _vectorLayers.push(l);
                                _processLayer(oLayer, l);
                            }// end kml

                            if (oLayer.type === 'customlayer') {
                                var hook_url = 'customLayers/' + oLayer.id + '.js';
                                if (oLayer.url && oLayer.url.slice(-3)==='.js') {
                                    hook_url = oLayer.url;
                                }
                                $.ajax({
                                    url: hook_url,
                                    dataType: "script",
                                    success : function (customLayer, textStatus, request) {
                                        if (mviewer.customLayers[oLayer.id].layer) {
                                            var l = mviewer.customLayers[oLayer.id].layer;
                                            if (oLayer.style && mviewer.featureStyles[oLayer.style]) {
                                                l.setStyle(mviewer.featureStyles[oLayer.style]);
                                            }
                                            _vectorLayers.push(l);
                                            _processLayer(oLayer, l);
                                        }
                                        // This seems to be useless. To be removed?
                                        if (mviewer.customLayers[oLayer.id].handle) {
                                        }
                                        _showCheckedLayers();
                                    },
                                    error: function (request, textStatus, error) {
                                        console.log( "error custom Layer : " + error );
                                    }
                                });
                            }
                            if ($(this).parent().is("group")) {
                                _themes[themeid].groups[$(this).parent().attr("id")].layers[oLayer.id] = oLayer;
                            } else {
                                _themes[themeid].layers[oLayer.id] = oLayer;
                            }
                        }); //fin each layer
                    }); // fin each theme
                } // fin de else

                _initDataList();
                _initVectorOverlay();
                search.init(xml, _map, _sourceOverlay);
                _initPanelsPopup();
                _initGeolocation();
                _initTools();

                //PERMALINK
                if (config.lb && $.grep(_backgroundLayers, function (n) {
                    return n.get('blid') === config.lb;
                })[0]) {

                    this.setBaseLayer(config.lb);
                } else {
                    this.setBaseLayer($(xml).find('baselayers').find('[visible="true"]').attr("id"));
                }

                if (config.l) {
                    _setVisibleOverLayers(config.l);
                } else {
                    if (!config.wmc) {
                        _showCheckedLayers();
                    }
                }

                //Export PNG
                if (applicationOverride.attr("exportpng") && document.getElementById('exportpng')) {
                    var exportPNGElement = document.getElementById('exportpng');
                    if ('download' in exportPNGElement) {
                        exportPNGElement.addEventListener('click', function(e) {
                            _map.once('postcompose', function(event) {
                                try {
                                    var canvas = event.context.canvas;
                                    exportPNGElement.href = canvas.toDataURL('image/png');
                                }
                                catch(err) {
                                    _message(err);
                                }
                            });
                            _map.renderSync();
                        }, false);
                    } else {
                        $("#exportpng").hide();
                    }
                } else {
                    $("#exportpng").hide();
                }
                _map.on('moveend', _mapChange);
                //Handle zoom change
                _map.getView().on('change:resolution', _mapZoomChange);

                if (_showhelp_startup) {
                    $("#help").modal('show');
                }

                return _map;
        },

        customLayers: {},

        customControls: {},

        tools: { activeTool: false},

         /**
         * Public Method: popupPhoto
         *
         */

        popupPhoto: function (src) {
            $("#imagepopup").find("img").attr("src",src);
            $("#imagepopup").modal('show');
        },

        /**
         * Public Method: zoomToLocation
         *
         */

        zoomToLocation: function (x, y, zoom, lib) {
            if (_sourceOverlay) {
                _sourceOverlay.clear();
            }
            var ptResult = ol.proj.transform([x, y], 'EPSG:4326', _projection.getCode());
            _map.getView().setCenter(ptResult);
            _map.getView().setZoom(zoom);
        },



        /**
         * Public Method: showLocation
         *
         */

        showLocation: function (proj,x, y) {
            //marker
            var ptResult = ol.proj.transform([x, y], proj, _projection.getCode());
            _marker.setPosition(ptResult);
            $("#els_marker").show();
            _map.render();
        },

        /**
         * Public Method: print
         *
         */

        print: function () {

        },

        /**
         * Public Method: geoloc
         *
         */

        geoloc: function () {
            if ($("#geolocbtn").hasClass('btn-default')){

              $("#geolocbtn").removeClass('btn-default');
              $("#geolocbtn").addClass('btn-success');

              _geolocation.setTracking(true);

              _geolocation.once('change', function(evt) {
                _map.getView().setZoom(18);
              });
              geolocON = _geolocation.on('change', function(evt) {

                coordinates = _geolocation.getPosition();
                _map.getView().setCenter(coordinates);
                iconFeature = new ol.Feature({
                  geometry: new ol.geom.Point(coordinates)
                });
                iconFeatureStyle = new ol.style.Style({
                  image: new ol.style.Icon({
                    src: 'img/legend/hiking_custom.png'
                  })
                });
                iconFeature.setStyle(iconFeatureStyle);

                var accuracyFeature = new ol.Feature();
                accuracyFeature.setGeometry(_geolocation.getAccuracyGeometry());
                _sourceGeolocation.clear();
                _sourceGeolocation.addFeature(iconFeature);
                _sourceGeolocation.addFeature(accuracyFeature);

            });
          } else if ($("#geolocbtn").hasClass('btn-success')){
            $("#geolocbtn").removeClass('btn-success');
            $("#geolocbtn").addClass('btn-default');
            _geolocation.setTracking(false);
            //_geolocation.unByKey(geolocON);
            _sourceGeolocation.clear();

        }
        },

        /**
         * Public Method: geoloc
         *
         */

        northRotate: function () {
            //_map.getView().setRotation(0);
            _map.getView().animate({rotation: 0});
        },

        /**
         * Public Method: hideLocation
         *
         */

        hideLocation: function ( ) {
            $("#els_marker").hide();
        },

        /**
         * Public Method: sendToGeorchestra
         *
         */

        sendToGeorchestra: function () {
            var params = {
                "services": [],
                "layers" : []
            };
            $.each(_overLayers, function(i, layer) {
                if (layer.layer.getVisible()) {
                    var layername = layer.id;
                    params.layers.push({
                        "layername" : layername,
                        "owstype" : "WMS",
                        "owsurl" : layer.url
                    });
                }
            });
            if (params.layers.length > 0) {
                $("#georchestraFormData").val(JSON.stringify(params));
                $("#georchestraForm").submit();
            }
        },

        /**
         * Public Method: mapShare
         *
         */

        mapShare: function () {
            var myurl = this.setPermalink();
        }, // fin function tools toolbar

        addLayer: function (layer) {
            var classes = ["list-group-item", "mv-layer-details"];
            if (!layer.toplayer) {
                classes.push("draggable");
            }

            var view = {
                cls:classes.join(" "),
                layerid: layer.layerid,
                title: layer.title,
                opacity: layer.opacity,
                crossorigin: layer.crossorigin,
                legendurl: layer.legendurl,
                attribution: layer.attribution,
                metadata: layer.metadata,
                tooltipControl: false,
                styleControl: false,
                attributeControl: false,
                timeControl: false
            };

            if (layer.type === 'customlayer' && layer.tooltip) {
                view.tooltipControl = true;
            }
            if (layer.styles && layer.styles.split(",").length > 1 &&
                layer.stylesalias && layer.stylesalias.split(",").length > 1) {
                view.styleControl = true;
                var styles = [];
                layer.styles.split(",").forEach( function (style, i) {
                    styles.push ({"style" : style, "label": layer.stylesalias.split(",")[i]});
                });
                view.styles = styles;
            }

            if (layer.attributefilter && layer.attributevalues != "undefined" && layer.attributefield != "undefined") {
                view.attributeControl = true;
                view.attributeLabel = layer.attributelabel || 'Filtrer';
                var options = [];
                if (layer.attributefilterenabled === false) {
                    options.push({"label": "Par défaut", "attribute": "all"});
                }
                layer.attributevalues.forEach(function (attribute) {
                    options.push({"label": attribute, "attribute": attribute});
                });
                view.attributes = options;
            }

            if (layer.timefilter) {
                view.timeControl = true;
            }

            var item = Mustache.render(mviewer.templates.layerControl, view);
            if (layer.customcontrol && mviewer.customControls[layer.layerid] && mviewer.customControls[layer.layerid].form) {
                item = $(item).find('.mv-custom-controls').append(mviewer.customControls[layer.layerid].form).closest(".mv-layer-details");
            }

            if (_topLayer && $("#layers-container .toplayer").length > 0) {
                $("#layers-container .toplayer").after(item);
            } else {
                $("#layers-container").prepend(item);
            }
            _setLayerScaleStatus(layer, _calculateScale(_map.getView().getResolution()));
            $("#"+layer.layerid+"-layer-opacity").slider({});
            $("#"+layer.layerid+"-layer-summary").popover({container: 'body', html: true});
            $("#"+layer.layerid+"-layer-summary").attr("data-content",layer.summary);
            if (layer.attributefilterenabled === true) {
                //Activate  CQL for this layer
            }
            //Time Filter
            //Time Filter slider and slider-range
            if (layer.timefilter && (layer.timecontrol === 'slider' || layer.timecontrol === 'slider-range')) {
                var ticks_labels;
                var ticks;
                var slider_options;
                var default_values;
                var onSliderChange;
                if (layer.timevalues) {

                    ticks_labels = layer.timevalues;
                    ticks = _createPseudoTicks(layer.timevalues);
                    if (layer.timecontrol === 'slider') {
                        default_value = parseInt(ticks_labels[ticks_labels.length -1]);
                        $(".mv-time-player-selection[data-layerid='"+layer.layerid+"']").text(default_value);
                    } else if (layer.timecontrol === 'slider-range') {
                        default_value = [0, layer.timevalues.length -1];
                        //Set wms filter to see all data and not only the last
                        var range = [parseInt(layer.timevalues[0]), parseInt(layer.timevalues[layer.timevalues.length -1])];
                        wms_timefilter = range.join("/");
                        mviewer.setLayerTime( layer.layerid, wms_timefilter );
                    }

                    slider_options = {
                        value:default_value,
                        tooltip: 'show',
                        tooltip_position: 'bottom',
                        ticks_labels: ticks_labels,
                        ticks: ticks,
                        step:1,
                        formatter: function(val) {
                            var value;
                            if (Array.isArray(val)) {
                                if (val[0] === val[1]) {
                                    value = parseInt(ticks_labels[val[0]]);
                                } else {
                                    value = [parseInt(ticks_labels[val[0]]), parseInt(ticks_labels[val[1]])];
                                }
                            } else {
                                value = parseInt(ticks_labels[val]);
                            }
                            return value;
                        }
                    };

                    onSliderChange = function (data) {
                        var wms_timefilter;
                        if (Array.isArray(data.value.newValue)) {
                                wms_timefilter = [parseInt(ticks_labels[data.value.newValue[0]]),
                                parseInt(ticks_labels[data.value.newValue[1]])].join("/");
                            } else {
                                wms_timefilter = parseInt(ticks_labels[data.value.newValue]);
                            }
                        mviewer.setLayerTime( layer.layerid, wms_timefilter );
                    };

                } else if (layer.timemin && layer.timemax) {
                    default_value = parseInt(layer.timemax);
                    ticks_labels = [layer.timemin];
                    ticks = [parseInt(layer.timemin)];
                    for (var i = parseInt(layer.timemin)+1; i < parseInt(layer.timemax); i++) {
                        ticks_labels.push('');
                        ticks.push(i);
                    }
                    ticks_labels.push(layer.timemax);
                    ticks.push(parseInt(layer.timemax));

                    slider_options = {
                        min:parseInt(layer.timemin),
                        max:parseInt(layer.timemax),
                        step:1,
                        value:default_value,
                        tooltip: 'show',
                        tooltip_position: 'bottom',
                        ticks_labels: ticks_labels,
                        ticks: ticks
                   };

                    onSliderChange = function ( data ) {
                        mviewer.setLayerTime( layer.layerid, data.value.newValue );
                    };

                }
                //slider && slider-range

                $("#"+layer.layerid+"-layer-timefilter")
                    .addClass("mv-slider-timer")
                    .slider(slider_options);
                $("#"+layer.layerid+"-layer-timefilter").slider().on('change', onSliderChange);
                if (ticks_labels.length > 7) {
                    $("#"+layer.layerid+"-layer-timefilter").closest(".form-group")
                        .find(".slider-tick-label").addClass("mv-time-vertical");
                }

                if (layer.timecontrol === 'slider') {
                    //Activate the time player
                    $('.mv-time-player[data-layerid="'+layer.layerid+'"]').click(function(e) {
                        var ctrl = e.currentTarget;
                        $(ctrl).toggleClass("active");
                        if ($(ctrl).hasClass("active")) {
                            mviewer.playLayerTime($(ctrl).attr("data-layerid"), ctrl);
                        }
                    });


                // slider-range
                } else if (layer.timecontrol === 'slider-range') {
                    $("#"+layer.layerid+"-layer-timefilter").closest(".form-group")
                        .removeClass("form-group-timer").addClass("form-group-timer-range");
                    //Remove time player
                    $('.mv-time-player[data-layerid="'+layer.layerid+'"]').remove();
                } else {
                    //Remove time player
                    $('.mv-time-player[data-layerid="'+layer.layerid+'"]').remove();
                }
            }

            //Time Filter calendar
            if (layer.timefilter && layer.timecontrol === 'calendar') {
                var options = {format: "yyyy-mm-dd", language: "fr", todayHighlight: true, minViewMode: 0,  autoclose: true};
                if (layer.timemin && layer.timemax) {
                    options.startDate = new Date(layer.timemin);
                    options.endDate = new Date(layer.timemax)
                }

                switch (layer.timeinterval) {
                    case "year":
                        options.minViewMode = 2;
                         break;
                    case "month":
                        options.startView = 2,
                        options.minViewMode = 1;
                         break;
                    default:
                        break;
                }
                $("#"+layer.layerid+"-layer-timefilter")
                    .addClass("mv-calendar-timer")
                    .addClass("form-control")
                    .wrap('<div class="input-group date"></div>');

                $("#"+layer.layerid+"-layer-timefilter")

                $("#"+layer.layerid+"-layer-timefilter").closest('div')
                    .append('<span class="input-group-addon"><i class="glyphicon glyphicon-th"></i></span>')
                    .datepicker(options);

                $("#"+layer.layerid+"-layer-timefilter").on('change', function(data,cc){
                        mviewer.setLayerTime( layer.layerid, data.currentTarget.value );
                });

            }
            //End Time filter
            if ($("#layers-container").find("li").length > 1) {
                //set Layer to top on the map
                var actionMove = {
                    layerName: layer.layerid,
                    layerRef: $("#layers-container li[data-layerid='"+layer.layerid+"']").next().attr("data-layerid"),
                    action: "up"};

                mviewer.orderLayer(actionMove);
            }
            var oLayer = _overLayers[layer.layerid];
            oLayer.layer.setVisible(true);
            //Only for second and more loads
            if (oLayer.attributefilter && oLayer.layer.getSource().getParams()['CQL_FILTER']) {
                var activeFilter = oLayer.layer.getSource().getParams()['CQL_FILTER'];
                var activeAttributeValue = activeFilter.split('=')[1].replace(/\'/g, "");
                $("#"+layer.layerid+"-attributes-selector option[value='"+activeAttributeValue+"']").prop("selected", true);
                $('.mv-layer-details[data-layerid="'+layer.layerid+'"] .layerdisplay-subtitle .selected-attribute span')
                    .text(activeAttributeValue);
            }

            var activeStyle = false;
            if (oLayer.type==='wms' && oLayer.layer.getSource().getParams()['STYLES']) {
                activeStyle = oLayer.layer.getSource().getParams()['STYLES'];
                var refStyle= activeStyle;
                //update legend image if nec.
                var legendUrl = _getlegendurl(layer);
                $("#legend-" + layer.layerid).attr("src", legendUrl);
            }
            if (oLayer.styles ) {
                var selectCtrl = $("#"+layer.layerid+"-styles-selector")[0];
                if (activeStyle) {
                    var selectedStyle = $("#"+layer.layerid+"-styles-selector option[value*='"+activeStyle.split('@')[0]+"']")
                        .prop("selected", true);
                }
                $('.mv-layer-details[data-layerid="'+layer.layerid+'"] .layerdisplay-subtitle .selected-sld span')
                    .text(selectCtrl.options[selectCtrl.selectedIndex].label);
            } else {
                $('.mv-layer-details[data-layerid="'+layer.layerid+'"] .layerdisplay-subtitle .selected-sld').remove();
            }

            if (!oLayer.attributefilter) {
                $('.mv-layer-details[data-layerid="'+layer.layerid+'"] .layerdisplay-subtitle .selected-attribute').remove();
            }
            if (!oLayer.attributefilter && !oLayer.styles) {
                $('.mv-layer-details[data-layerid="'+layer.layerid+'"] .layerdisplay-subtitle').remove();
            }

            var li = $(".mv-nav-item[data-layerid='"+layer.layerid+"']");
            li.find("a span").removeClass("mv-unchecked").addClass("mv-checked");
            li.find("input").val(true);
            // activate custom controls
            if (layer.customcontrol && mviewer.customControls[layer.layerid]) {
                mviewer.customControls[layer.layerid].init();
            }
            if (layer.type === 'customlayer' && layer.tooltip && layer.tooltipenabled) {
                info.toggleTooltipLayer($('.layer-tooltip[data-layerid="'+layer.layerid+'"]')[0]);
            }
            if (layer.expanded) {
                this.toggleLayerOptions($('.mv-layer-details[data-layerid="'+layer.layerid+'"]')[0]);
            }
            $("#legend").removeClass("empty");
            if (_toggleAllLayersFromTheme) {
                var newStatus = _getThemeStatus(layer.theme);
                _setThemeStatus(layer.theme, newStatus);
            }
        },
        removeLayer: function (el) {
            var item;
            if ( !$(el).is( "li" ) ) {
                item = $(el).closest("li");
            } else {
                item = $(el);
            }
            var layerid = item.attr("data-layerid");
            var layer = _overLayers[layerid];
            item.remove();
            layer.layer.setVisible(false);
            var li = $(".mv-nav-item[data-layerid='"+layerid+"']");
            li.find("a span").removeClass("mv-checked").addClass("mv-unchecked");
            li.find("input").val(false);
            // deactivate custom controls
            if (layer.customcontrol && mviewer.customControls[layer.layerid]) {
                mviewer.customControls[layer.layerid].destroy();
            }
            //Remove Layer infos in info panels
            mviewer.removeLayerInfo(layer.layerid);
            //check if layers-container is empty
            if ($("#layers-container .list-group-item").length === 0) {
                $("#legend").addClass("empty");
            }
            if (_toggleAllLayersFromTheme) {
                var newStatus = _getThemeStatus(layer.theme);
                _setThemeStatus(layer.theme, newStatus);
            }
        },
        removeAllLayers: function () {
            $("#layers-container .list-group-item").each( function (id, item) {
                mviewer.removeLayer(item);
            });
        },
        toggleLayer: function (el) {
            var li = $(el).closest("li");
            if ( li.find("input").val() === 'false' ) {
                mviewer.addLayer(_overLayers[$(li).data("layerid")]);
            } else {
                var el = $(".mv-layer-details[data-layerid='"+li.data("layerid")+"']")
                mviewer.removeLayer(el);
            }
        },
        toggleMenu: function (transition) {
            if (transition) {
                $( "#wrapper, #sidebar-wrapper, #page-content-wrapper").removeClass("notransition");
            } else {
                $( "#wrapper, #sidebar-wrapper, #page-content-wrapper").addClass("notransition");
            }
            $("#wrapper").toggleClass("toggled-2");
            $("#menu-toggle-2,.menu-toggle").toggleClass("closed");
            $('#menu ul').hide();
        },

        toggleLegend: function () {
            $("#legend").toggleClass("active");
        },
        toggleParameter: function (li) {
            var span = $(li).find("span");
            var parameter = false;
            if (span.hasClass('mv-unchecked') === true ) {
                span.removeClass('mv-unchecked').addClass('mv-checked');
                parameter = true;
            } else {
                span.removeClass('mv-checked').addClass('mv-unchecked');
            }
            switch (li.id) {
                case "param_search_bbox":
                    _searchparams.bbox = parameter;
                    break;
                case "param_search_localities":
                    _searchparams.localities = parameter;
                    break;
                case "param_search_features":
                    _searchparams.features = parameter;
                    break;
            }

        },
        toggleLayerOptions: function (el) {
            $(el).closest("li").find(".mv-layer-options").slideToggle();
            //hack slider js
            $(el).closest("li").find(".mv-slider-timer").slider('relayout');
            if ($(el).find("span").hasClass("glyphicon glyphicon-plus")) {
                $(el).find("span").removeClass("glyphicon glyphicon-plus").addClass("glyphicon glyphicon-minus");
            } else {
                $(el).find("span").removeClass("glyphicon glyphicon-minus").addClass("glyphicon glyphicon-plus");
            }
        },

        setLayerStyle: function (layerid, style, selectCtrl) {
            var _layerDefinition = _overLayers[layerid];
            var styleRef = style;
            var _source = _layerDefinition.layer.getSource();
            if (_layerDefinition.attributefilter && _layerDefinition.attributestylesync) {
            //Récupère la valeur active de la liste déroulante
                //var attributeValue = $("#"+ layerid + "-attributes-selector").val();
                var attributeValue = 'all';
                var styleBase = style.split('@')[0];
                if (_source.getParams().CQL_FILTER) {
                    attributeValue = _source.getParams().CQL_FILTER.split('=')[1].replace(/\'/g, "");
                }
                if ( attributeValue != 'all' ) {
                    style = [styleBase, '@', attributeValue.toLowerCase().sansAccent()].join("");
                }
            }
            _source.getParams()['STYLES'] = style;
            _layerDefinition.style = style;
            _source.changed();
            var styleLabel = $(selectCtrl).find("option[value='"+styleBase+"'], option[value='"+styleRef+"']").attr("label");
            $('.mv-layer-details[data-layerid="'+layerid+'"] .layerdisplay-subtitle .selected-sld span').text(styleLabel);
            var legendUrl = _getlegendurl(_layerDefinition);
            $("#legend-" + layerid).fadeOut( "slow", function() {
                // Animation complete
                 $("#legend-" + layerid).attr("src", legendUrl).fadeIn();
            });
            $('.mv-nav-item[data-layerid="'+layerid+'"]').attr("data-legendurl",legendUrl).data("legendurl",legendUrl);

        },

        setLayerAttribute: function (layerid, attributeValue, selectCtrl) {
            var _layerDefinition = _overLayers[layerid];
            var _source = _layerDefinition.layer.getSource();
            if ( attributeValue === 'all' ) {
                delete _source.getParams()['CQL_FILTER'];
            } else {
                _source.getParams()['CQL_FILTER'] = _layerDefinition.attributefield +
                "='" + attributeValue.replace("'","''") + "'";
            }
            if (_layerDefinition.attributestylesync) {
                //need update legend ad style applied to the layer
                var currentStyle =  _layerDefinition.style;
                var newStyle;
                //Respect this convention in sld naming : stylename@attribute eg style1@departement plus no accent no Capitale.
                if (attributeValue != 'all') {
                    newStyle = [currentStyle.split("@")[0], "@", attributeValue.sansAccent().toLowerCase()].join("");
                } else {
                    newStyle = currentStyle.split("@")[0];
                }
                _source.getParams()['STYLES'] = newStyle;
                _layerDefinition.style = newStyle;
                var legendUrl = _getlegendurl(_layerDefinition);
                $("#legend-" + layerid).fadeOut( "slow", function() {
                    // Animation complete
                    $("#legend-" + layerid).attr("src", legendUrl).fadeIn();
                });
                $('.mv-nav-item[data-layerid="'+layerid+'"]').attr("data-legendurl",legendUrl).data("legendurl",legendUrl);
            }
            _source.changed();
            $('.mv-layer-details[data-layerid="'+layerid+'"] .layerdisplay-subtitle .selected-attribute span')
                .text(selectCtrl.options[selectCtrl.selectedIndex].label);
        },

        setLayerTime: function (layerid, filter_time) {
            //Fix me
            var str = filter_time.toString();
            var test = str.length;
            switch (test) {

                case 6:
                    filter_time = str.substr(0,4) + '-' + str.substr(4,2);
                    break;
                case 8:
                    filter_time = str.substr(0,4) + '-' + str.substr(4,2) +  '-' + str.substr(6,2);
                    break;
                default:
                    filter_time = filter_time;
            }
            var _layerDefinition = _overLayers[layerid];
            var _source = _layerDefinition.layer.getSource();
            _source.getParams()['TIME'] = filter_time;
            $(".mv-time-player-selection[data-layerid='"+layerid+"']").text('Patientez...');
            var key = _source.on('imageloadend', function() {
                ol.Observable.unByKey(key);
                $(".mv-time-player-selection[data-layerid='"+layerid+"']").text(filter_time);
            });
            _source.changed();

            if (_source.hasOwnProperty("tileClass")) {
                _source.updateParams({'ol3_salt': Math.random()});
            }
        },

        playLayerTime: function (layerid, ctrl) {
            var t = $("#"+layerid+"-layer-timefilter");
            var timevalues = _overLayers[layerid].timevalues;
            var animation;
            t.slider({tooltip:'always'}).slider('refresh');

            function play() {
                if ($(ctrl).hasClass("active") && $("#"+layerid+"-layer-timefilter").length > 0) {
                    var nextvalue = (t.slider('getValue')+1)%timevalues.length;
                    t.slider('setValue', nextvalue, true, true);
                } else {
                    t.slider({tooltip:'show'}).slider('refresh');
                    clearInterval(animation);
                }
            }
            animation = setInterval(play, 2000);
        },

        setInfoPanelTitle: function (el, panel) {
            var title = $(el).attr("data-original-title");
            $("#"+panel +" .mv-header h5").text(title);
        },

        nextBackgroundLayer: function () {
            //Get activeLayer
            var id = 0;
            for (var i = 0; i < _backgroundLayers.length; i += 1) {
                var l = _backgroundLayers[i];
                if (l.getVisible()) {
                    id=i;
                    break;
                }
            }
            var nexid=(id+1)%_backgroundLayers.length;
            var i, ii;
            for (i = 0, ii = _backgroundLayers.length; i < ii; ++i) {
                _backgroundLayers[i].set('visible', (i == nexid));
            }
            nexid=(nexid+1)%_backgroundLayers.length;
            //get the next thumb
            var thumb = $(_options).find('baselayer[id="'+_backgroundLayers[nexid].get('blid')+'"]').attr("thumbgallery");
            var title = $(_options).find('baselayer[id="'+_backgroundLayers[nexid].get('blid')+'"]').attr("label");
            $("#backgroundlayersbtn").css("background-image", 'url("'+thumb+'")');
            $("#backgroundlayersbtn").attr("data-original-title", title);
            $("#backgroundlayersbtn").tooltip('hide').tooltip({
                placement: 'top',
                trigger: 'hover',
                html: true,
                container: 'body',
                template: mviewer.templates.tooltip
            });
        },

        /**
         * Public Method: getLayer
         *
         */

        getLayer: function (idlayer) {
            return _overLayers[idlayer];
        },

        removeLayerInfo: function (layerid) {
            var tab = $('.nav-tabs li[data-layerid="'+layerid+'"]');
            var panel = tab.closest(".popup-content").parent();
            var tabs = tab.parent().find("li");
            var info = $(tab.find("a").attr("href"));

            if ( tabs.length === 1 ) {
                tab.remove();
                info.remove();
                if (panel.hasClass("active")) {
                    panel.toggleClass("active");
                }
                $("#els_marker").hide();
            } else {
                if ( tab.hasClass("active") ) {
                    //Activation de l'item suivant
                    var _next_tab = tab.next();
                    _next_tab.find("a").click();
                    /*var _next_info = info.next();
                    _next_tab.addClass("active");
                    _next_info.addClass("active");
                    _next_tab.find("a").click();*/
                    tab.remove();
                    info.remove();
                } else {
                    tab.remove();
                    info.remove();
                }
            }

        },

        alert: function (msg, cls) {
            _message(msg, cls);
        },

        legendSize: function (img) {
            if (img.width > 250) {
                //$(img).addClass("big-legend");
                $(img).closest("div").addClass("big-legend");
                $(img).parent().append('<span onclick="mviewer.popupPhoto(' +
                    'this.parentElement.getElementsByTagName(\'img\')[0].src)" ' +
                    'class="text-big-legend"><span><span class="glyphicon glyphicon-resize-full" aria-hidden="true">' +
                    '</span> Agrandir la légende</span></span>');
            }
        },

        toggleAllThemeLayers: function (e) {
            e.preventDefault;
            var themeid = $(e.currentTarget).closest("li").attr("id").split("theme-layers-")[1];
            var theme = _themes[themeid];
            var status = _getThemeStatus(themeid);
            var visibility = false;
            if (status.status !== "full") {
                visibility = true;
            }
            if (visibility) {
                if (theme.groups) {
                    $.each( theme.groups, function( key, group ) {
                        $.each( group.layers, function( key, layer ) {
                            if (!layer.layer.getVisible()) {
                                mviewer.addLayer(layer);
                            }
                        });
                    });
                } else {
                    $.each( theme.layers, function( key, layer ) {
                        if (!layer.layer.getVisible()) {
                            mviewer.addLayer(layer);
                        }
                    });
                }
            } else {
                if (theme.groups) {
                    $.each( theme.groups, function( key, group ) {
                        $.each( group.layers, function( key, layer ) {
                            if (layer.layer.getVisible()) {
                                mviewer.removeLayer($(".mv-layer-details[data-layerid='"+key+"']"));
                            }
                        });
                    });
                } else {
                    $.each( theme.layers, function( key, layer ) {
                        if (layer.layer.getVisible()) {
                            mviewer.removeLayer($(".mv-layer-details[data-layerid='"+key+"']"));
                        }
                    });
                }
            }
            //var newStatus = _getThemeStatus(themeid);
            _setThemeStatus(themeid);
            e.stopPropagation();
        },

        getLayers: function () {
            return _overLayers;
        },

        getLonLatZfromGeometry: _getLonLatZfromGeometry,

        ajaxURL : _ajaxURL

    }; // fin return

})();