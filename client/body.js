// Body
Template.body.onRendered(function () {
  this.autorun(function () {
    if (!Meteor.userId()) {
      Session.set(C.ACTIVE_FEATURE, null)
      Session.set(C.FEATURE_UPDATED, false)
    }
  })
})
Template.body.helpers({
  hasActiveFeature: function () {
    return Session.get(C.ACTIVE_FEATURE)
  },
  theftCount: function () {
    return Session.get(C.THEFT_COUNT)
  },
  theftCountColor: function () {
    return Math.max(255 - ((Session.get(C.THEFT_COUNT) || 0) * 10), 0)
  }
})
Template.body.events({
  'click .locate': function () {
    map.setView(Geolocation.latLng())
  }
})