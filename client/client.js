if (Meteor.isClient) {
  const MAPBOX_KEY = 'pk.eyJ1Ijoib251cnV5YXIiLCJhIjoiWDVxcEFPQSJ9.J0rUBNRgkBeLFwr0Kzjt-g'
  const MAP_ID = 'mapbox.streets'
  const MAP_ZOOM = 15

  const ACTIVE_LOCATION = 'activelocation'
  const GEONAMES_USERNAME = 'onuruyar'

  let map, markers, directions
  heat = null

  Meteor.startup(() => {
    Mapbox.debug = true
    Mapbox.load({
      plugins: ['markercluster'] //, 'heat', 'directions']
    })
  })

  // Map
  Template.map.onRendered(function () {
    var latLng = {lat: 51.5279475, lng: -0.0685651} // TODO: get user location, keep static for dev purposes
    Session.set(ACTIVE_LOCATION, latLng)

    this.autorun(() => {
      // wait for map to load
      if (!Mapbox.loaded()) return

      // get active location
      let loc = Session.get(ACTIVE_LOCATION),
          features = Features.find()
      
      // get country code from locatoin and subscribe to features for current location
      if (loc) {
        HTTP.get(
          'http://api.geonames.org/findNearbyPlaceNameJSON',
          {params: {lat: loc.lat, lng:loc.lng, username: GEONAMES_USERNAME}},
          (err, resp) => {
            if (err) {
              console.error('geonames request failed', err)
            } else if ( resp.statusCode === 200) {
              this.subscribe('features', {countryCode: resp.data.geonames[0].countryCode, lat: loc.lat, lng: loc.lng})
            }
          }
        )
      }
      
      // initialize map for first time
      if (!map) {
        L.mapbox.accessToken = MAPBOX_KEY
        // create map and set view
        map = L.mapbox.map('map', MAP_ID).setView(loc, MAP_ZOOM)
        // add heatmap
        // heat = L.heatLayer([], {maxZoom: 18}).addTo(map)
        // set event to update activeLocation from map center
        map.on({
          moveend: function () { Session.set(ACTIVE_LOCATION, map.getCenter()) }
        })
        // add marker cluster
        markers = new L.MarkerClusterGroup().addTo(map)
        // create the initial directions object, from which the layer
        // and inputs will pull data.
        // directions = L.mapbox.directions({
        //     profile: 'mapbox.cycling'
        // })
        // L.mapbox.directions.layer(directions).addTo(map)
      }

      // add features to heatmap
      // if (heat) heat.setLatLngs(features.map((feature) => feature.geometry.coordinates))

      // create markers
      if (markers) {
        markers.clearLayers()
        features.forEach((feature, index) => {
          var loc = new L.LatLng(...feature.geometry.coordinates)
          let title = `${feature.properties.id}, ${feature.properties.date}`
          let marker = L.marker(loc, {
            icon: L.mapbox.marker.icon({'marker-symbol': 'danger', 'marker-color': 'FF0033'}),
          })
          marker.bindPopup(`<pre>${JSON.stringify(feature.properties, null, 2)}</pre>`)
          markers.addLayer(marker)
          // switch (index) {
          // case 0:
          //   directions.setOrigin(loc)
          //   break
          // case features.count() - 1:
          //   directions.setDestination(loc)
          //   break
          // default:
          //   directions.addWaypoint(index, loc)
          //   break
          // }
        })
      }
    })
  })
}