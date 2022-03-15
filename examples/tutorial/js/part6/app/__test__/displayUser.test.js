var getUsers = require('../src/index.js')

test('displays a user after a click', () => {
  // Set up our document body
  let users =  getUsers().then( users => users )
  expect(users).toEqual([{"first_name":"Lee","last_name":"Earth"}]);
});