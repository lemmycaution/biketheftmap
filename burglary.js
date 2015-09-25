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
    endDate = new Date()
    // CrimesFDS.TIMESPAN_IN_MONTHS back from today
    startDate = new Date()
    startDate.setMonth(startDate.getMonth() - CrimesFDS.TIMESPAN_IN_MONTHS)
    // find cached data from local db
    crimes = Crimes.find({
      'location': {
        $nearSphere: {
           $geometry: {
              type : "Point",
              coordinates : [params.lat, params.lng]
           },
           $maxDistance: MAX_DISTANCE
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
  const MAP_ZOOM = 15
  const HEATMAP_OPACITY = 0.2
  const HEATMAP_RADIUS = 75
  const ACTIVE_LOCATION = 'activelocation'
  const GOOGLE_MAPS_LIBS = ['https://google-maps-utility-library-v3.googlecode.com/svn/tags/markerclustererplus/2.1.2/markerclustererplus/src/markerclusterer_packed.js']

  let markers = {}, infoWindow = null, heatmap = null, markerCluster = null

  Meteor.startup(() => {
    GoogleMaps.load({ v: '3', libraries: 'visualization' })
    GOOGLE_MAPS_LIBS.forEach((lib) => GoogleMaps.loadUtilityLibrary(lib))
  })

  // Map
  Template.map.helpers({
    geolocationError: function() {
      var error = Geolocation.error()
      return error && error.message
    },
    mapOptions: function() {
      // set active location from geolocation from device 
      var latLng = Geolocation.latLng()
      Session.set(ACTIVE_LOCATION, latLng)
      // Initialize the map once we have the latLng.
      if (GoogleMaps.loaded() && latLng) {
        return {
          center: new google.maps.LatLng(latLng.lat, latLng.lng),
          zoom: MAP_ZOOM
        }
      }
    }
  })
  Template.map.onCreated(function () {
    // maps ready?
    GoogleMaps.ready('map', (map) => {
      infoWindow = new google.maps.InfoWindow()
      this.autorun(function () {
        // subscribe to crimes for current location
        let loc = Session.get(ACTIVE_LOCATION), crimes = Crimes.find(), heatmapData, markerClusterData
        if (loc) Meteor.subscribe("crimes", {lat: loc.lat, lng: loc.lng})

        crimes.forEach((crime) => {
          let position = new google.maps.LatLng(...crime.location.coordinates)
          if (markers[crime._id]) {
              markers[crime._id].setPosition(position)
          }else{
            markers[crime._id] = new google.maps.Marker({
              position: position,
              map: map.instance
            })
            markers[crime._id].addListener('click', function() {
              map.instance.setCenter(position)
              infoWindow.setContent(`<pre>${JSON.stringify(crime, null, 2)}</pre>`)
              infoWindow.open(map.instance, markers[crime._id])
              // if (crime.owner === Meteor.userId()) {
              //   Session.set(ACTIVE_INCIDENT, incident._id)
              // }
            });
          }
        })

        heatmapData = crimes.map((crime) => new google.maps.LatLng(...crime.location.coordinates))
        if (heatmap) {
          heatmap.setData(heatmapData)
        } else {
          heatmap = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: map.instance,
            radius: HEATMAP_RADIUS,
            opacity: HEATMAP_OPACITY
          })
        }

        markerClusterData = _.values(markers)
        if (markerCluster) {
          markerCluster.clearMarkers()
          markerCluster.addMarkers(markerClusterData)
        }else{
          markerCluster = new MarkerClusterer(map.instance, markerClusterData)
        }

      })
      // when user drag maps, change active location to map center
      map.instance.addListener('center_changed', function() {
        let mapCenter = map.instance.getCenter()
        Session.set(ACTIVE_LOCATION, {lat: mapCenter.G, lng: mapCenter.K})
      })
    })
  })
}