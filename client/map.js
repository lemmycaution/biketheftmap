// Map
Template.map.onRendered(function () {
  let map, markers, turfLayer, userMarker

  this.autorun(() => {

    let geoLoc = Geolocation.latLng(),
        loc,
        features,
        activeFeature,
        area,
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
    if (loc) {
      HTTP.get(
        'http://api.geonames.org/findNearbyPlaceNameJSON',
        {params: {lat: loc.lat, lng:loc.lng, username: C.GEONAMES_USERNAME}},
        (err, resp) => {
          if (err) {
            console.error('geonames request failed', err)
          } else if ( resp.statusCode === 200) {
            this.subscribe('features', {
              countryCode: resp.data.geonames[0].countryCode, 
              lat: loc.lat, 
              lng: loc.lng
            })
          }
        }
      )
    }
    
    // initialize map for first time
    if (!map) {
      L.mapbox.accessToken = C.MAP_KEY
      // L.mapbox.geocoder('mapbox.places').reverseQuery(loc, (err,data) => console.log(data))

      // setup map
      map = L.mapbox.map('map', C.MAP_ID)
        .setView(loc, C.MAP_ZOOM)
        .on({
          moveend: function () { Session.set(C.ACTIVE_LOCATION, map.getCenter()) }
        })

      // add marker cluster
      markers = new L.MarkerClusterGroup().addTo(map)

      // add turf layer
      turfLayer = L.mapbox.featureLayer([], {
        color: '#fff',
        opacity: 1,
        fillColor: '#000',
        fillOpacity: 0.6
      }).addTo(map)

      // add user marker
      userMarker = L.marker(geoLoc, {
        icon: L.mapbox.marker.icon({
          'marker-symbol': 'bicycle', 
          'marker-color':  '60c4f7'
        }),
      }).addTo(map)
    }

    // render markers
    markers.clearLayers()
    features.forEach((feature, index) => {
      let loc = new L.LatLng(...feature.geometry.coordinates),
          title = `${feature.properties.id}, ${feature.properties.date}`,
          belongsToUser = feature.properties.owner === Meteor.userId(),
          marker = L.marker(loc, {
            draggable: userMarker,
            icon: L.mapbox.marker.icon({
              'marker-symbol': 'danger', 
              'marker-color': belongsToUser ? 'FF0033' : '330066'
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

    // let pt = {type: 'Feature', geometry: {type:'Point', coordinates: [loc.lng,loc.lat]} }
    area = turf.buffer(turf.point([loc.lng,loc.lat]), C.COUNT_DISTANCE, C.COUNT_UNIT)
    // var result = turf.featurecollection([area, pt])
    turfLayer.setGeoJSON(area)
    within = turf.within({
      type: 'FeatureCollection', 
      features: features.map((f) => {
        f.geometry.coordinates = f.geometry.coordinates.reverse()
        return f
      })
    }, area)
    Session.set(C.THEFT_COUNT, within.features.length)

    userMarker.setLatLng(geoLoc)

    if (Session.get(C.ACTIVE_FEATURE) && (activeFeature = Features.findOne(Session.get(C.ACTIVE_FEATURE)))) {
      map.setView(activeFeature.geometry.coordinates, C.MAP_ZOOM)
    }
    map.invalidateSize({debounceMoveend: true})

  })
})