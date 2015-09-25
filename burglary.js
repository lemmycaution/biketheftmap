Crimes = new Mongo.Collection("crimes")

/**
* Foreign data source for Crimes collection
*/
class CrimesFDS {
  
  /** 
  * Duration in months to check back for crime values in time.
  */
  static get TIMESPAN_IN_MONTHS () { return  6 }

  /**
  * Generates dates starting from today to go back TIMESPAN_IN_MONTHS.
  */
  static queryDates () {
    let dates = [], date, i
    for (i = 0; i < CrimesFDS.TIMESPAN_IN_MONTHS; i++) {
      date = new Date()
      // set date to beginning of the day
      date.setHours(0);date.setMinutes(0);date.setMilliseconds(0)
      date.setMonth(date.getMonth() - i)
      dates.push(date)
    }
    return dates
  }

  /** 
  * Base api url.
  */
  get apiUrl () {
    throw new Error('Not Implemented')
  }

  /**
  * Fetches results from external api.
  */
  fetch (params, callback) {
    HTTP.get(this.apiUrl, {params: params}, (err, resp) => {
      if (resp.statusCode === 200) {
        callback(null, this.parse(resp))
      } else {
        callback(err, resp)
      }
    })
  }

  /** 
  * Parses api response.
  */
  parse (resp) {
    return resp.data
  }

  /**
  * Transforms single object from api response to standard crime object
  * basic model is below, rest can be varying depends on api response.
  * Example;
  * {
  *   "_id" : "YbaS4j83B2ty6B43S",
  *   "id" : "668eaa0b4508d5edfc2669f328af87325f1d35d7f0296d1e87d1ef5fa445de3f",
  *   "location" : {
  *     "type" : "Point",
  *     "coordinates" : [
  *       51.520059,
  *       -0.084251
  *     ]
  *   },
  *   "date" : ISODate("2015-06-01T00:00:00Z")
  * }
  *
  * Members;
  * - _id: Mongodb ObjectId, creating by bulglary app
  * - id: String, uniq id from external API
  * - location: Point, location of crime (see geoJSON for more info)
  * - date: Date, date of crime
  */
  transform (crime) {
    return crime
  }
}

/**
* data.police.uk FDS wrapper
*/
class CrimesGB extends CrimesFDS {

  get apiUrl () {
    return 'https://data.police.uk/api/crimes-street/bicycle-theft'
  }
  
  fetch (params, callback) {
    // data.police.uk needs date formatted as 'YYYY-MM'
    // javascript month stars from 0 so add 1
    params.date = params.date.getFullYear().toString() + '-' + (params.date.getMonth() + 1).toString()
    console.log(`requesting ${this.apiUrl} params:`, params)
    super(params, callback)
  }
  
  parse (resp) {
    return resp.data.map((crime) => {return this.transform(crime)})
  }

  transform (crime) {
    let crimeDate = crime.month.split('-')
    crime.date = new Date(crimeDate[0] + '-' + crimeDate[1] + '-01')
    delete crime.month

    crime.id = crime.persistent_id
    delete crime.persistent_id

    crime.location = {
      type: 'Point',
      coordinates: [
        parseFloat(crime.location.latitude),
        parseFloat(crime.location.longitude)
      ]
    }

    return crime
  }
}


if (Meteor.isServer) {
  // foreign data source mapper per country, only GB implemented for now
  const FDS = {
    GB: new CrimesGB()
  }

  const MAX_DISTANCE = 1600 // 1 mile in meters

  // index for geo spatial search
  Meteor.startup(() => Crimes._ensureIndex({latlng: "2dsphere"}))

  // server: publish street level bicycle theft crimes for location and date
  Meteor.publish('crimes', function (params) {
    let countryCode, startDate, endDate, crimes, fds, handle

    check(params, {lat: Number, lng: Number})

    //TODO: get country code by location
    countryCode = 'GB' 
    // today
    startDate = new Date()
    // CrimesFDS.TIMESPAN_IN_MONTHS back from today
    endDate = new Date()
    endDate.setMonth(endDate.getMonth() - CrimesFDS.TIMESPAN_IN_MONTHS)
    // find cached data from local db
    crimes = Crimes.find({
      'location': {
        $nearSphere: {
           $geometry: {
              type : "Point",
              coordinates : [params.lat, params.lng]
           },
           $maxDistance: 1600
        }
      },
      date: {$gt: startDate, $lte: endDate}
    })
    // has foreign data source for country?
    fds = FDS[countryCode]

    // fetch from fds if there is no cached data and fds exists for country
    if (crimes.count() === 0 && fds) {
      // we need to store handle to publish crimes data after fetching via fds
      handle = crimes.observeChanges({
        added: (id, crime) => { this.added('crimes', id, crime) }
      })
      // fetch from fds for specific dates
      CrimesFDS.queryDates().forEach((date, i, dates) => {
        // update request params with date
        params.date = date
        // get actual crimes in standardized format
        fds.fetch(params, (error, newCrimes) => {
          if (error) {
            console.error('fds.fetch failed', error)
            return false
          }
          // insert new crimes to local db
          newCrimes.forEach((crime) => {
            if (!Crimes.findOne({id: crime.id})) Crimes.insert(crime)
          })
          // if all dates fetched then publish to client
          if (i === dates.length - 1) this.ready()
        })
      })
      // stop publisher when client unsubscribe
      this.onStop(() => handle.stop())

    // return existing crimes form local db
    } else {
      return crimes
    }
  })
}

if (Meteor.isClient) {
  // Meteor.startup(function() {
  //   GoogleMaps.load()
  // })
  // Map
  // Template.map.helpers({
  //   geolocationError: function() {
  //     var error = Geolocation.error()
  //     return error && error.message
  //   },
  //   mapOptions: function() {
  //     var latLng = Geolocation.latLng()
  //     // Initialize the map once we have the latLng.
  //     if (GoogleMaps.loaded() && latLng) {
  //       return {
  //         center: new google.maps.LatLng(latLng.lat, latLng.lng),
  //         zoom: MAP_ZOOM
  //       }
  //     }
  //   }
  // })
  Template.map.onCreated(function () {
    this.autorun(function () {
      // subscribe to crimes for current location
      var loc = Geolocation.latLng()
      if (loc) Meteor.subscribe("crimes", {lat: loc.lat, lng: loc.lng})
    })
  })
}


// Incidents = new Mongo.Collection("incidents")
//
// if (Meteor.isClient) {
//   var MAP_ZOOM = 15
//   var SEARCH_RADIUS = 25
//   var ACTIVE_INCIDENT = 'activeIncident'
//   var INCIDENT_UPDATED = 'incidentUpdated'
//   var LOCATION = 'location'
//   var markers = {}
//
//   Meteor.startup(function() {
//     GoogleMaps.load()
//   })
//
//   // reset session
//   Session.setDefault(ACTIVE_INCIDENT, null)
//   Session.setDefault(INCIDENT_UPDATED, false)
//
//   // subscribe user incidents
//   Meteor.subscribe("incidents")
//
//   // Incidents
//   Template.incidentForm.helpers({
//     hasActiveIncident: function () {
//       return Session.get(ACTIVE_INCIDENT)
//     },
//     activeIncident: function () {
//       return Incidents.findOne(Session.get(ACTIVE_INCIDENT))
//     }
//   })
//   Template.incidentForm.events({
//     'submit form': function (e) {
//       var incidentId, data
//
//       e.preventDefault()
//       // if session has active incident created previously call update
//       incidentId = Session.get(ACTIVE_INCIDENT)
//       if (incidentId) {
//         data = {
//           brand: e.target.brand.value,
//           model: e.target.model.value,
//           price: e.target.price.value
//         }
//         Meteor.call("updateIncident", incidentId, data, function (error, result) {
//           if (error) {
//             alert('Ops!, something went wrong', error)
//           } else {
//             Session.setDefault(INCIDENT_UPDATED, true)
//           }
//         })
//       // if a new incident add it
//       } else {
//         data = Geolocation.latLng()
//         if (!data) return alert('Location not found, please enable geolocation')
//         Meteor.call("addIncident", data, function (error, result) {
//           if (error) {
//             alert('Ops!, something went wrong', error)
//           } else {
//             Session.set(ACTIVE_INCIDENT, result)
//           }
//         })
//       }
//     },
//     'reset form': function () {
//       var incidentId = Session.get(ACTIVE_INCIDENT)
//       if (incidentId) {
//         Meteor.call('removeIncident', incidentId, function (error, result) {
//           if (error) {
//             alert('Ops!, something went wrong', error)
//           } else {
//             Session.set(INCIDENT_UPDATED, false)
//             Session.set(ACTIVE_INCIDENT, null)
//             if (markers[incidentId]) markers[incidentId].setMap(null)
//           }
//         })
//       }
//     }
//   })
//
//   // Map
//   Template.map.helpers({
//     geolocationError: function() {
//       var error = Geolocation.error()
//       return error && error.message
//     },
//     mapOptions: function() {
//       var latLng = Geolocation.latLng()
//       // Initialize the map once we have the latLng.
//       if (GoogleMaps.loaded() && latLng) {
//         return {
//           center: new google.maps.LatLng(latLng.lat, latLng.lng),
//           zoom: MAP_ZOOM
//         }
//       }
//     }
//   })
//
//   Template.map.onCreated(function() {
//     var self = this
//
//     GoogleMaps.ready('map', function(map) {
//       // var marker
//       // var markers = {}
//
//       // Create and move the marker when latLng changes.
//       self.autorun(function() {
//         var incidents
//         var latLng = Geolocation.latLng()
//         if (! latLng) return
//
//         // If the marker doesn't yet exist, create it.
//         // if (! marker) {
//         //   marker = new google.maps.Marker({
//         //     position: new google.maps.LatLng(latLng.lat, latLng.lng),
//         //     map: map.instance
//         //   })
//         // }
//         // // The marker already exists, so we'll just change its position.
//         // else {
//         //   marker.setPosition(latLng)
//         // }
//
//         // Center and zoom the map view onto the current position.
//         // map.instance.setCenter(marker.getPosition())
//         map.instance.setCenter(latLng)
//         map.instance.setZoom(MAP_ZOOM)
//
//         // find incidents around location
//         incidents = Incidents.find({
//           'location.latlng': {
//             $near: [latLng.lat, latLng.lng], $maxDistance: SEARCH_RADIUS
//           }
//         })
//
//         incidents.forEach(function (incident) {
//           if (markers[incident._id]) {
//             markers[incident._id].setPosition(incident.location.latlng)
//           }else{
//             markers[incident._id] = new google.maps.Marker({
//               position: incident.location.latlng,
//               map: map.instance,
//               title: incident._id
//             })
//             markers[incident._id].addListener('click', function() {
//               map.instance.setCenter(markers[incident._id].getPosition())
//               if (incident.owner === Meteor.userId()) {
//                 Session.set(ACTIVE_INCIDENT, incident._id)
//               }
//             });
//           }
//         })
//       })
//     })
//   })
// }
//
// if (Meteor.isServer) {
//   // Methods
//   Meteor.methods({
//     addIncident: function (latLng) {
//       // Make sure the user is logged in before inserting a task
//       if (! Meteor.userId()) {
//         throw new Meteor.Error("not-authorized")
//       }
//
//       // meteor doesn't dupport mongodb native geospatial search for now
//       // so save location for both new and old version
//       return Incidents.insert({
//         location: {
//           // this is for future
//           // more info and examples: http://tugdualgrall.blogspot.co.uk/2014/08/introduction-to-mongodb-geospatial.html
//           geo: {
//             type: 'Point',
//             coordinates: [latLng.lat, latLng.lng]
//           },
//           // this is currently in use
//           latlng: latLng
//         },
//         createdAt: new Date(),
//         owner: Meteor.userId()
//       })
//     },
//     updateIncident: function (incidentId, data) {
//       var incident = Incidents.findOne(incidentId)
//       // Make sure only the incident owner can update the incident
//       if (incident.owner !== Meteor.userId()) {
//         throw new Meteor.Error("not-authorized")
//       }
//
//       return Incidents.update(incidentId, {$set :{details: data}})
//     },
//     removeIncident: function (incidentId) {
//       var incident = Incidents.findOne(incidentId)
//       // Make sure only the incident owner can update the incident
//       if (incident.owner !== Meteor.userId()) {
//         throw new Meteor.Error("not-authorized")
//       }
//
//       return Incidents.remove(incidentId)
//     }
//   })
//
//   // publish user incidents to client
//   Meteor.publish("incidents", function () {
//     return Incidents.find({owner: this.userId})
//   })
//
// }