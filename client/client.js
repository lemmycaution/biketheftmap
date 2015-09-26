if (Meteor.isClient) {
  const MAPBOX_KEY = 'pk.eyJ1Ijoib251cnV5YXIiLCJhIjoiWDVxcEFPQSJ9.J0rUBNRgkBeLFwr0Kzjt-g'
  const MAP_ID = 'mapbox.streets'
  const MAP_ZOOM = 15

  const ACTIVE_LOCATION = 'activelocation'
  const GEONAMES_USERNAME = 'onuruyar'
  
  const ACTIVE_FEATURE = 'activefeature'
  const FEATURE_UPDATED = 'featureupdated'

  let map, markers, directions
  // heat = null

  Meteor.startup(() => {
    Mapbox.debug = true
    Mapbox.load({
      plugins: ['markercluster'] //, 'heat', 'directions']
    })
    // reset session
    Session.setDefault(ACTIVE_FEATURE, null)
    Session.set(FEATURE_UPDATED, false)
  })

  // Map
  Template.map.onRendered(function () {

    this.autorun(() => {
      if (map && Session.get(ACTIVE_FEATURE)) {
        let activeFeature = Features.findOne(Session.get(ACTIVE_FEATURE))
        if (activeFeature) map.setView(activeFeature.geometry.coordinates, 20)
      }
      
      let latLng = Geolocation.latLng() // {lat: 51.5279475, lng: -0.0685651}

      // wait for map to load
      if (!Mapbox.loaded() || !latLng) return

      if (!Session.get(ACTIVE_LOCATION)) Session.set(ACTIVE_LOCATION, latLng)

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
          let loc = new L.LatLng(...feature.geometry.coordinates)
          let title = `${feature.properties.id}, ${feature.properties.date}`
          let userMarker = feature.properties.owner === Meteor.userId()
          let marker = L.marker(loc, {
            draggable: userMarker,
            icon: L.mapbox.marker.icon({
              'marker-symbol': 'danger', 
              'marker-color': userMarker ? 'FF0033' : '330066'
            }),
          })
          marker.bindPopup(`<pre>${JSON.stringify(feature.properties, null, 2)}</pre>`)
          marker.feature = feature
          markers.addLayer(marker)
          if (userMarker) {
            marker.on({
              click: () => Session.set(ACTIVE_FEATURE, marker.feature._id),
              dragend: (e) => {
                let loc = e.target.getLatLng()
                Meteor.call('updateFeature', marker.feature._id, {'geometry.coordinates': [loc.lat, loc.lng]}, function (error, result) {
                  if (error) {
                    alert(`Ops!, something went wrong, ${error.message}`)
                  } else {
                    Session.set(FEATURE_UPDATED, true)
                  }
                })
              }
            })
          }
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

  // Form
  Template.form.helpers({
    geolocationError: function() {
      let error = Geolocation.error()
      return error && error.message
    },
    hasActiveFeature: function () {
      return Session.get(ACTIVE_FEATURE)
    },
    featureUpdated: function () {
      return Session.get(FEATURE_UPDATED)
    },
    activeFeature: function () {
      return Features.findOne(Session.get(ACTIVE_FEATURE))
    }
  })

  Template.form.events({
    'click .close': function (e) {
      e.preventDefault()
      Session.set(ACTIVE_FEATURE, null)
    },
    'submit form': function (e) {
      let featureId, data

      e.preventDefault()
      // if session has active feature created previously call update
      featureId = Session.get(ACTIVE_FEATURE)
      if (featureId) {
        // will set to feature.properties.meta
        data = {
          'properties.meta': {
            brand: e.target.brand.value,
            model: e.target.model.value,
            price: e.target.price.value,
            description: e.target.description.value
          }
        }
        Meteor.call('updateFeature', featureId, data, function (error, result) {
          if (error) {
            alert(`Ops!, something went wrong, ${error.message}`)
          } else {
            Session.set(FEATURE_UPDATED, true)
          }
        })
        // if a new feature add it  
      } else {
        data = Geolocation.latLng()
        if (!data) return alert('Location not found, please enable geolocation')

        Meteor.call('addFeature', data, function (error, featureId) {
          if (error) {
            alert(`Ops!, something went wrong, ${error.message}`)
          } else {
            Session.set(ACTIVE_FEATURE, featureId)
          }
        })
      }
    },
    'reset form': function () {
      let featureId = Session.get(ACTIVE_FEATURE)
      if (featureId) {
        Meteor.call('removeFeature', featureId, function (error, result) {
          if (error) {
            alert(`Ops!, something went wrong, ${error.message}`)
          } else {
            Session.set(FEATURE_UPDATED, false)
            Session.set(ACTIVE_FEATURE, null)
          }
        })
      }
    }
  })
}