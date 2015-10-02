// Map
map = null
Template.map.onRendered(function () {
  let markers, turfLayer, userMarker, countryCode //, heat

  this.autorun(() => {

    let geoLoc = Geolocation.latLng(),
        loc,
        features,
        activeFeature,
        buffer,
        within

    // wait for map and location
    if (!Mapbox.loaded() || !geoLoc) return

    // set initial location
    if (!Session.get(C.ACTIVE_LOCATION)) Session.set(C.ACTIVE_LOCATION, geoLoc)

    // get active location, can be geolocation or map center
    loc = Session.get(C.ACTIVE_LOCATION)

    // get published features cursor
    features = Features.find()
    
    // get country code from locatoin and subscribe to features for current location
    // TODO: make it indipendent from external API
    if (!countryCode && loc) {
      HTTP.get(
        'http://api.geonames.org/findNearbyPlaceNameJSON',
        {params: {lat: loc.lat, lng:loc.lng, username: C.GEONAMES_USERNAME}},
        (err, resp) => {
          if (err) {
            console.error('geonames request failed', err)
          } else if ( resp.statusCode === 200) {
            countryCode = resp.data.geonames[0].countryCode
            this.subscribe('features', {
              countryCode: countryCode, 
              lat: loc.lat, 
              lng: loc.lng
            })
          }
        }
      )
    } else {
      this.subscribe('features', {
        countryCode: countryCode, 
        lat: loc.lat, 
        lng: loc.lng
      })
    }
    
    // initialize map for first time
    if (!map) {
      L.mapbox.accessToken = C.MAP_KEY
      // L.mapbox.geocoder('mapbox.places').reverseQuery(loc, (err,data) => console.log(data))

      // setup map
      map = L.mapbox.map('map', C.MAP_ID, {
          tileLayer: {format: 'jpg70'},
          center: loc,
          zoom: C.MAP_ZOOM,
          maxZoom: C.MAP_ZOOM,
          attributionControl: false
        })
      map.on('moveend', function () { Session.set(C.ACTIVE_LOCATION, map.getCenter()) })
      map.on('zoomend', function () { calculateTheftCount() })

      // add marker cluster
      markers = new L.MarkerClusterGroup({
        // pointToLayer: function(cluster) {
        //   return L.circleMarker({
        //     // show the number of markers in the cluster on the icon.
        //     'raidus': cluster.getChildCount(),
        //     'marker-color': '#E1272A'
        //   })
        // },
        iconCreateFunction: function(cluster) {
          return L.mapbox.marker.icon({
            // show the number of markers in the cluster on the icon.
            'marker-symbol': cluster.getChildCount(),
            'marker-color': 'E1272A'
          })
        }
      }).addTo(map)

      // add turf layer
      // turfLayer = L.mapbox.featureLayer([], {style:L.mapbox.simplestyle.style}).addTo(map)

      // add user marker
      userMarker = L.marker(geoLoc, {
        icon: L.mapbox.marker.icon({
          'marker-symbol': 'bicycle', 
          'marker-color':  'E1272A'
        }),
      }).addTo(map)
      
      // heat = L.heatLayer([], {
 //        minOpacity: 0.05,
 //        maxZoom: C.MAP_ZOOM,
 //        radius: 60,
 //        blur: 20,
 //        max: 1.2,
 //          //gradient
 //        zoomAnimation: true
 //      }).addTo(map)
    }

    // render markers
    markers.clearLayers()
    features.forEach((feature, index) => {
      let loc = new L.LatLng(...feature.geometry.coordinates),
          title = `${feature.properties.id}, ${feature.properties.date}`,
          belongsToUser = feature.properties.owner === Meteor.userId(),
          // marker = L.circleMarker(loc, {
          // fillColor: belongsToUser ? '#FF0033' : '#330066',
          marker = L.marker(loc, {
            draggable: userMarker,
            icon: L.mapbox.marker.icon({
              'marker-symbol': 'danger',
              'marker-color': belongsToUser ? 'E3486C' : 'E1272A'
            }),
          })

      marker.bindPopup(`<pre>${JSON.stringify(feature.properties, null, 2)}</pre>`)
      marker.feature = feature
      markers.addLayer(marker)

      if (belongsToUser) {
        marker.on({
          click: () => {
            Session.set(C.ACTIVE_FEATURE, marker.feature._id)
          },
          dragend: (e) => {
            let loc = e.target.getLatLng()
            Meteor.call('updateFeature', marker.feature._id, {'geometry.coordinates': [loc.lat, loc.lng]}, function (error, result) {
              if (error) {
                alert(`Ops!, something went wrong, ${error.message}`)
              } else {
                Session.set(C.FEATURE_UPDATED, true)
              }
            })
          }
        })
      }
    })

    calculateTheftCount()

    userMarker.setLatLng(geoLoc)
    
    // heat.setLatLngs(features.map((feature) => feature.geometry.coordinates))

    if (Session.get(C.ACTIVE_FEATURE) && (activeFeature = Features.findOne(Session.get(C.ACTIVE_FEATURE)))) {
      map.setView(activeFeature.geometry.coordinates, C.MAP_ZOOM)
    }
    map.invalidateSize({debounceMoveend: true})
    
    function calculateTheftCount () {
      let zoomFactor = (C.MAP_ZOOM - map.getZoom() + 1)
      // let pt = {type: 'Feature', geometry: {type:'Point', coordinates: [loc.lng,loc.lat]} }
      buffer = turf.buffer(turf.point([loc.lng,loc.lat]), C.COUNT_DISTANCE * zoomFactor, C.COUNT_UNIT)
      // var result = turf.featurecollection([buffer, pt])
      // buffer.features.forEach((f)=>{
      //   f.properties = {
      //     'fill': '#ff3366',
      //     'stroke-opacity': 0.1,
      //     'fill-opacity': ((Session.get(C.THEFT_COUNT) || 0) / (C.TEHFT_TRESHOLD * zoomFactor))
      //   }
      // })
      // turfLayer.setGeoJSON(buffer)
      within = turf.within({
        type: 'FeatureCollection', 
        features: features.map((f) => {
          return turf.point(f.geometry.coordinates.reverse())
        })
      }, buffer)
      Session.set(C.THEFT_COUNT, within.features.length)
    }

  })
})