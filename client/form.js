// Form
Template.form.helpers({
  geolocationError: function() {
    let error = Geolocation.error()
    return error && error.message
  },
  hasActiveFeature: function () {
    return Session.get(C.ACTIVE_FEATURE)
  },
  featureUpdated: function () {
    return Session.get(C.FEATURE_UPDATED)
  },
  activeFeature: function () {
    return Features.findOne(Session.get(C.ACTIVE_FEATURE))
  }
})

Template.form.events({
  'click .close': function (e) {
    e.preventDefault()
    Session.set(C.ACTIVE_FEATURE, null)
  },
  'submit form': function (e) {
    let featureId, data

    e.preventDefault()

    // if session has active feature created previously call update
    featureId = Session.get(C.ACTIVE_FEATURE)
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
          Session.set(C.FEATURE_UPDATED, true)
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
          Session.set(C.ACTIVE_FEATURE, featureId)
        }
      })
    }
  },
  'reset form': function () {
    let featureId = Session.get(C.ACTIVE_FEATURE)
    if (featureId) {
      Meteor.call('removeFeature', featureId, function (error, result) {
        if (error) {
          alert(`Ops!, something went wrong, ${error.message}`)
        } else {
          Session.set(C.FEATURE_UPDATED, false)
          Session.set(C.ACTIVE_FEATURE, null)
        }
      })
    }
  }
})