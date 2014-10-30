//To use this service, make sure you're adding 'userService' to a controller, like so:
//	app.controller('mealsController', ['$scope', '$resource', 'userService', function ($scope, $resource, userService)
//	and then, make sure that the controller uses: var User = $resource('/api/users');
//This service will provide anything necessary when interacting with the backend for users. Adding, deleting, adding meal buddies, etc.

app.factory('userService', ['$http', function($http, $resource) {
	var user = '/api/users';
	var userBuddies = '/api/users/buddies';
	var deleteBuddies = '/api/users/buddies/delete';
	var facebookLogin = '/api/users/facebook';
	var googleLogin = '/api/users/google';

	var userService = {};

	// Gets all the users from the backend, no filtering. Can parse through them in results.
	userService.getAllUsers = function() {
		return $http.get(user);
	};

	// Gets a user from the backend with the specific ID.
	userService.getUserWithID = function(key) {
		return $http.get(user + '?key=' + key);
	};

	// Creates a new user and adds it onto the backend. Name can be null (which is an anonymous user)
	userService.addNewUser = function(name, facebookID, googleID, birthDate, description, profession) {
		var userKey = generateUniqueKey();
		var request = { 'key':userKey, 'name':name, 'facebookID':facebookID, 'googleID':googleID, 'birthDate':birthDate, 'description':description, 'profession':profession, 'mealBuddies':[] };
		var res =  $http.post(user, request);
		res.success(function(result) {
			if (result != 'error') {
				sessionStorage.userID = angular.toJson(result.key);
				localStorage.user = angular.toJson(result);
			} else {
				userService.addNewUser(name, birthDate, description, profession);
			}
		});
		return res;
	};

	// Empty method. Will be used for updating a user's information.
	userService.updateUser = function(user, name, birthDate, description, profession) {
			
	};

	// Empty method. Will be used to delete a user from the database. Not sure if this is needed.
	userService.deleteUser = function(userID) {

	};

	userService.findByFacebook = function(facebookID){
		return $http.get(facebookLogin + '?facebookID=' + facebookID);
	};

	userService.findByGoogle = function(googleID){
		return $http.get(googleLogin + '?googleID=' + googleID);
	};

	//Adds new meal buddy for a user. Three states:
	//- If it's just a 5 letter string, they are confirmed meal buddies
	//- If it's a 5 letter string preceded by a '?', that means someone else is waiting for this user's confirmation
	//- If it's a 5 letter string preceded by a '!', that means this user is waiting for someone else to confirm
	userService.addMealBuddy = function(buddyKey) {
		userService.getUserWithID(buddyKey).success(function(res) {
			if (res.length > 0) {
				$http.get(userBuddies + '?key=' + angular.fromJson(localStorage.user).key).success(function(results) {
					//check array results to see if meal buddies contains the buddy key
					var alreadyAdded = false;
					var buddyPending = '';
					for (buddy of results) {
						var keyString = buddy.key.replace(/[!]|[?]/g,'');
						if (keyString == buddyKey) {
							alreadyAdded = true;
							if (buddy.key.substring(0,1) == '?') {
								buddyPending = keyString;
							}
						}
					}
					if (!alreadyAdded) {
						var request = { 'userKey': angular.fromJson(localStorage.user).key, 'buddyKey': '!'+buddyKey };
						$http.put(userBuddies, request);
						var buddyRequest = { 'userKey': buddyKey, 'buddyKey': '?'+angular.fromJson(localStorage.user).key };
						$http.put(userBuddies, buddyRequest);
					}
					else {
						if (buddyPending.length > 0) {
							userService.confirmMealBuddy(buddyPending);
						}
						else {
							console.log('already added');
						}
					}
				})
			}
			else {
				console.log('no such user for this buddy');
			}
		});
	};

	// Returns an array of meal buddies. Empty array if no meal buddies exist.
	userService.getMealBuddies = function() {
		return $http.get(userBuddies + '?key=' + angular.fromJson(localStorage.user).key);
	};

	// Confirms a meal buddy that has a pending request to the user.
	userService.confirmMealBuddy = function(buddyKey) {
		$http.get(userBuddies + '?key=' + angular.fromJson(localStorage.user).key).success(function(results) {
			//check array results to see if meal buddies contains the buddy key with a '?'
			var requestPending = false;
			for (buddy of results) {
				var keyString = '?'+ buddyKey;
				if (keyString == buddy.key) {
					requestPending = true;
				}
			}
			if (requestPending) {
				var deleteRequest = { 'userKey': angular.fromJson(localStorage.user).key, 'buddyKey': '?'+buddyKey };
				$http.put(deleteBuddies, deleteRequest);
				var buddyDeleteRequest = { 'userKey': buddyKey, 'buddyKey': '!'+angular.fromJson(localStorage.user).key };
				$http.put(deleteBuddies, buddyDeleteRequest);

				var request = { 'userKey': angular.fromJson(localStorage.user).key, 'buddyKey': buddyKey };
				$http.put(userBuddies, request);
				var buddyRequest = { 'userKey': buddyKey, 'buddyKey': angular.fromJson(localStorage.user).key };
				$http.put(userBuddies, buddyRequest);
			}
			else {
				console.log('user does not have a pending request');
			}
		})
	};

	// Deletes or rejects a meal buddy. Up to client, if you're rejecting a request, pass in 'true' to reject.
	userService.deleteMealBuddy = function(buddyKey, reject) {
		//reject or delete
		$http.get(userBuddies + '?key=' + angular.fromJson(localStorage.user).key).success(function(results) {
			if (reject) {
				var deleteRequest = { 'userKey': angular.fromJson(localStorage.user).key, 'buddyKey': '?'+buddyKey };
				$http.put(deleteBuddies, deleteRequest);
				var buddyDeleteRequest = { 'userKey': buddyKey, 'buddyKey': '!'+angular.fromJson(localStorage.user).key };
				$http.put(deleteBuddies, buddyDeleteRequest);
			} 
			else {				//delete a user already a friend
				var deleteRequest = { 'userKey': angular.fromJson(localStorage.user).key, 'buddyKey': buddyKey };
				$http.put(deleteBuddies, deleteRequest);
				var buddyDeleteRequest = { 'userKey': buddyKey, 'buddyKey': angular.fromJson(localStorage.user).key };
				$http.put(deleteBuddies, buddyDeleteRequest);
			}
		})
	};

	// Returns true or false depending on whether a user is in local storage.
	userService.isUserLoggedIn = function() {
		if (localStorage.user != 'loggedout') {
			return true;
		} else {
			return false;
		}
	};

	// Removes the user from localStorage
	userService.logoutUser = function() {
		localStorage.user = 'loggedout';
	}

	generateUniqueKey = function() {
	    var text = "";
	    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	    for( var i=0; i < 5; i++ )
	        text += possible.charAt(Math.floor(Math.random() * possible.length));

	    return text;
	}

	return userService;

}]);
