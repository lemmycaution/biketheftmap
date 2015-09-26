Meteor.startup(() => {
  Mapbox.debug = true
  Mapbox.load({
    plugins: C.MAP_PLUGINS
  })
  // reset session
  Session.setDefault(C.ACTIVE_FEATURE, null)
  Session.set(C.FEATURE_UPDATED, false)
  Session.set(C.ACTIVE_LOCATION, false)

})