app.controller('indexController', ['$scope', '$location', 'userService',
	function ($scope, $location, userService) {
		$scope.hideMealBuddies = true;
		$scope.showMealBuddiesButton = false;
		$scope.showingLoginButton = true;
		$scope.showingLogoutButton = false;
		$scope.showMealInfo = false;
		$scope.showMealSidebar = true;
		$scope.mealBuddyRequests = [];
		$scope.mealBuddies = [];

		$scope.UID = '';

		$scope.authenticated = false;

		$scope.hideMealInfo = function() {
			$scope.showMealInfo = false;
		}

		$scope.showtheMealSidebar = function() {
			if($scope.showMealSidebar == false){
				$scope.showMealSidebar = true;
			}
		}

		$scope.hideMealSidebar = function() {
			if($scope.showMealSidebar == true){
				$scope.showMealSidebar = false;
			}
		}

		$scope.hidetheMealBuddies = function(){
			if($scope.hideMealBuddies == false){
				$scope.hideMealBuddies = true;
			}
		}

		// Call this to show or hide the supp buddies (friends) button
		$scope.showSuppBuddiesButton = function() {
			$scope.showMealBuddiesButton = true;
		}

		$scope.hideSuppBuddiesButton = function() {
			$scope.showMealBuddiesButton = false;
		}

		// Call this to show or hide the login button
		$scope.showLoginButton = function() {
			$scope.showingLoginButton = true;
		}

		$scope.hideLoginButton = function() {
			$scope.showingLoginButton = false;
		}

		// Call this to show or hide the login button
		$scope.showLogoutButton = function() {
			$scope.showingLogoutButton = true;
		}

		$scope.hideLogoutButton = function() {
			$scope.showingLogoutButton = false;
		}

		// This allows the initial redirect when they come to the 
		// page based on whether or not they are logged in
		$scope.init = function() {
			if (userService.isUserLoggedIn()) {
				$location.path('main').replace();
			}
			else {
				$location.path('login').replace();
			}
		}
		$scope.init();

		$scope.logout = function() {
			userService.logoutUser();
			$location.path('login').replace();
			FB.api('/me/permissions', 'delete', function(response) {});
			gapi.auth.signOut();

			// TODO - Can someone just change this?
			$scope.authenticated = false;
			$scope.showingLoginButton = true;
			$scope.showingLogoutButton = false;
		}

		// Populate MealBuddies, and MealBuddyRequests to be displayed in the Meal Buddies SideBar
		$scope.populateMealBuddies = function() {
			$scope.UID = angular.fromJson(localStorage.user).key;
			$scope.mealBuddyRequests = [];
			$scope.mealBuddies = [];
			// Grab the users MealBuddies from the database
			userService.getMealBuddies().success( function(data1) {
				// Sort through MealBuddies: requests vs actual Meal Buddies
				for (mealBuddy of data1) {
					if (mealBuddy.key.substring(0, 1) == '!') {  // User has sent request to someone else
						// Pending Request, do nothing
					}
					else if (mealBuddy.key.substring(0, 1) == '?') {  // User has a request from someone else
						userService.getUserWithID(mealBuddy.key.substring(1, 6)).success(function(data2) {
							$scope.mealBuddyRequests.push(data2);
						});
					}
					else {  // Current Meal Buddies
						userService.getUserWithID(mealBuddy.key).success(function(data2) {
							$scope.mealBuddies.push(data2);
						});
					}
				}
			});
		}

		$scope.toggleMealBuddies = function() {
			$scope.populateMealBuddies();
			$scope.hideMealBuddies = !$scope.hideMealBuddies;
			if($scope.hideMealBuddies == true){
				$scope.showMealSidebar = true;
			}
			else{
				$scope.showMealSidebar = false;				
			}
			// $scope.showMealSidebar = false;
		}

		/* Facebook Integration Stuff */
		// This is called with the results from from FB.getLoginStatus().
		statusChangeCallback = function(response) {
			// The response object is returned with a status field that lets the
			// app know the current login status of the person.
			// Full docs on the response object can be found in the documentation
			// for FB.getLoginStatus().
			if (response.status === 'connected') {
				FB.api('/me', {fields: 'name'}, function(response) {
					sessionStorage.facebookID = response.id;
					sessionStorage.name  =response.name;
					$scope.authenticated = true;

					userService.findByFacebook(response.id).success(function(data) {

						if (data.length > 0) {
							var user = data[0];
							localStorage.user = angular.toJson(user);
							$location.path('main').replace();
						} else {
							if ($location.path() == '/login') {
								$scope.$broadcast('showUserInfo', null);
								if (!$scope.$$phase) {
									$scope.$apply();
								}
							}
							else {
								userService.addIDToUser('fb', sessionStorage.facebookID, sessionStorage.name);
							}
						}
					});
				});

				// Logged into your app and Facebook.
				// This is where the code goes on successfull login,
				// ie. change the page to the map.
			}
			else if (response.status === 'not_authorized') {
				// The person is logged into Facebook, but not your app.
			}
			else {
				// The person is not logged into Facebook, so we're not sure if
				// they are logged into this app or not.
			}
		}

		// This function is called when someone finishes with the Login
		// Button.  See the onlogin handler attached to it in the code below.
		checkLoginState = function() {
			FB.getLoginStatus(function(response) {
			statusChangeCallback(response);
			});
		}

		window.fbAsyncInit = function() {
			FB.init({
				appId      : '283325225209622',
				cookie     : true,  // enable cookies to allow the server to access the session
				xfbml      : true,  // parse social plugins on this page
				version    : 'v2.1' // use version 2.1
			});

			// Now that we've initialized the JavaScript SDK, we call
			// FB.getLoginStatus().  This function gets the state of the
			// person visiting this page and can return one of three states to
			// the callback.  They can be:
			//
			// 1. Logged into your app ('connected')
			// 2. Logged into Facebook, but not your app ('not_authorized')
			// 3. Not logged into Facebook and can't tell if they are logged into
			//    your app or not.
			//
			// These three cases are handled in the callback function.

			FB.getLoginStatus(function(response) {
				statusChangeCallback(response);
			});
		};

		// Load the SDK asynchronously
		(function(d, s, id) {
			var js, fjs = d.getElementsByTagName(s)[0];
			if (d.getElementById(id)) return;
			js = d.createElement(s); js.id = id;
			js.src = "//connect.facebook.net/en_US/sdk.js";
			fjs.parentNode.insertBefore(js, fjs);
		}(document, 'script', 'facebook-jssdk'));


		/* Google Integration Stuff */
		(function() {
			var po = document.createElement('script');
			po.type = 'text/javascript';
			po.async = true;
			po.src = 'https://apis.google.com/js/client:plusone.js?onload=render';
			var s = document.getElementsByTagName('script')[0];
			s.parentNode.insertBefore(po, s);
		})();

		/* Executed when the APIs finish loading */
		render = function() {
			// Additional params
			var additionalParams = {
				'theme' : 'dark'
			};
			gapi.signin.render('googleLogin', additionalParams);
		}

		getUserInfo = function() {
			// Step 4: Load the Google+ API
			gapi.client.load('plus', 'v1').then(function() {
				// Step 5: Assemble the API request
				var request = gapi.client.plus.people.get({
					'userId': 'me'
				});
				// Step 6: Execute the API request
				request.then(function(resp) {
					sessionStorage.googleID = resp.result.id;
					sessionStorage.name = resp.result.displayName;

					userService.findByGoogle(resp.result.id).success(function(data) {
						if (data.length) {
							var user = data[0];
							localStorage.user = angular.toJson(user);
							$location.path('main').replace();
						} else {
							if ($location.path() == '/login') {
								$scope.$broadcast('showUserInfo', null);
								if (!$scope.$$phase) {
									$scope.$apply();
								}
							}
							else {
								userService.addIDToUser('gg', sessionStorage.googleID, sessionStorage.name);
							}
						}
					});
				},
				function(reason) {
					console.log('Error: ' + reason.result.error.message);
				});
			});
		}


		signinCallback = function(authResult) {
			if (authResult['status']['signed_in']) {
				// Update the app to reflect a signed in user
				if(authResult['status']['method'] == 'PROMPT'){
					getUserInfo();
					$scope.authenticated = true;
				}
		    } 
		    else {
		    	// Update the app to reflect a signed out user
		    	// Possible error values:
		    	//   "user_signed_out" - User is signed-out
		    	//   "access_denied" - User denied access to your app
		    	//   "immediate_failed" - Could not automatically log in the user
		    	// console.log('Sign-in state: ' + authResult['error']);
		    }
		}
}]);