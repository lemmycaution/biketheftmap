Incidents = new Mongo.Collection("incidents")

if (Meteor.isClient) {
  var MAP_ZOOM = 15
  var SEARCH_RADIUS = 25
  var ACTIVE_INCIDENT = 'activeIncident'
  var INCIDENT_UPDATED = 'incidentUpdated'
  var LOCATION = 'location'
  var markers = {}

  Meteor.startup(function() {
    GoogleMaps.load()
  })

  // reset session
  Session.setDefault(ACTIVE_INCIDENT, null)
  Session.setDefault(INCIDENT_UPDATED, false)
    
  // subscribe user incidents
  Meteor.subscribe("incidents")

  // Incidents
  Template.incidentForm.helpers({
    hasActiveIncident: function () {
      return Session.get(ACTIVE_INCIDENT)
    },
    activeIncident: function () {
      return Incidents.findOne(Session.get(ACTIVE_INCIDENT))
    }
  })
  Template.incidentForm.events({
    'submit form': function (e) {
      var incidentId, data

      e.preventDefault()
      // if session has active incident created previously call update
      incidentId = Session.get(ACTIVE_INCIDENT)
      if (incidentId) {
        data = {
          brand: e.target.brand.value,
          model: e.target.model.value,
          price: e.target.price.value
        }
        Meteor.call("updateIncident", incidentId, data, function (error, result) {
          if (error) {
            alert('Ops!, something went wrong', error)
          } else {
            Session.setDefault(INCIDENT_UPDATED, true)
          }
        })
      // if a new incident add it  
      } else {
        data = Geolocation.latLng()
        if (!data) return alert('Location not found, please enable geolocation')
        Meteor.call("addIncident", data, function (error, result) {
          if (error) {
            alert('Ops!, something went wrong', error)
          } else {
            Session.set(ACTIVE_INCIDENT, result)
          }
        })
      }
    },
    'reset form': function () {
      var incidentId = Session.get(ACTIVE_INCIDENT)
      if (incidentId) {
        Meteor.call('removeIncident', incidentId, function (error, result) {
          if (error) {
            alert('Ops!, something went wrong', error)
          } else {
            Session.set(INCIDENT_UPDATED, false)
            Session.set(ACTIVE_INCIDENT, null)
            if (markers[incidentId]) markers[incidentId].setMap(null)
          }
        })
      }
    }
  })
  
  // Map
  Template.map.helpers({  
    geolocationError: function() {
      var error = Geolocation.error()
      return error && error.message
    },
    mapOptions: function() {
      var latLng = Geolocation.latLng()
      // Initialize the map once we have the latLng.
      if (GoogleMaps.loaded() && latLng) {
        return {
          center: new google.maps.LatLng(latLng.lat, latLng.lng),
          zoom: MAP_ZOOM
        }
      }
    }
  })

  Template.map.onCreated(function() {
    var self = this

    GoogleMaps.ready('map', function(map) {
      // var marker
      // var markers = {}

      // Create and move the marker when latLng changes.
      self.autorun(function() {
        var incidents
        var latLng = Geolocation.latLng()
        if (! latLng) return

        // If the marker doesn't yet exist, create it.
        // if (! marker) {
        //   marker = new google.maps.Marker({
        //     position: new google.maps.LatLng(latLng.lat, latLng.lng),
        //     map: map.instance
        //   })
        // }
        // // The marker already exists, so we'll just change its position.
        // else {
        //   marker.setPosition(latLng)
        // }

        // Center and zoom the map view onto the current position.
        // map.instance.setCenter(marker.getPosition())
        map.instance.setCenter(latLng)
        map.instance.setZoom(MAP_ZOOM)
        
        // find incidents around location
        incidents = Incidents.find({
          'location.latlng': {
            $near: [latLng.lat, latLng.lng], $maxDistance: SEARCH_RADIUS
          }
        })

        incidents.forEach(function (incident) {
          if (markers[incident._id]) {
            markers[incident._id].setPosition(incident.location.latlng)
          }else{
            markers[incident._id] = new google.maps.Marker({
              position: incident.location.latlng,
              map: map.instance,
              title: incident._id
            })
            markers[incident._id].addListener('click', function() {
              map.instance.setCenter(markers[incident._id].getPosition())
              if (incident.owner === Meteor.userId()) {
                Session.set(ACTIVE_INCIDENT, incident._id)
              }
            });
          }
        })
      })
    })
  })
}

if (Meteor.isServer) {
  // Methods
  Meteor.methods({
    addIncident: function (latLng) {
      // Make sure the user is logged in before inserting a task
      if (! Meteor.userId()) {
        throw new Meteor.Error("not-authorized")
      }

      // meteor doesn't dupport mongodb native geospatial search for now
      // so save location for both new and old version
      return Incidents.insert({
        location: {
          // this is for future
          // more info and examples: http://tugdualgrall.blogspot.co.uk/2014/08/introduction-to-mongodb-geospatial.html
          geo: {
            type: 'Point',
            coordinates: [latLng.lat, latLng.lng]
          },
          // this is currently in use
          latlng: latLng
        },
        createdAt: new Date(),
        owner: Meteor.userId()
      })
    },
    updateIncident: function (incidentId, data) {
      var incident = Incidents.findOne(incidentId)
      // Make sure only the incident owner can update the incident
      if (incident.owner !== Meteor.userId()) {
        throw new Meteor.Error("not-authorized")
      }

      return Incidents.update(incidentId, {$set :{details: data}})
    },
    removeIncident: function (incidentId) {
      var incident = Incidents.findOne(incidentId)
      // Make sure only the incident owner can update the incident
      if (incident.owner !== Meteor.userId()) {
        throw new Meteor.Error("not-authorized")
      }

      return Incidents.remove(incidentId)
    }
  })

  // publish user incidents to client
  Meteor.publish("incidents", function () {
    return Incidents.find({owner: this.userId})
  })

}