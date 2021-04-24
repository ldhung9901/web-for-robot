var navigation = false;
var pathed = false;
var homing = false;
var MAP_WIDTH = window.innerWidth * 0.65;
var MAP_HEIGHT = window.innerHeight - window.innerHeight * 0.08;
var target_linear_vel = 0.0;
var target_angular_vel = 0.0;
var control_linear_vel = 0.0;
var control_angular_vel = 0.0;
var ROBOT_MAX_LIN_VEL = 0.22;
var ROBOT_MAX_ANG_VEL = 2.84;
var ROBOT_LINEAR_VEL_STEP_SIZE = 0.08;
var ROBOT_ANGULAR_VEL_STEP_SIZE = 0.1;
function makeSimpleProfile(output, input, slop) {
  if (input > output) output = Math.min(input, output + slop);
  else if (input < output) output = Math.max(input, output - slop);
  else output = input;
  return output;
}
function constrain(input, low, high) {
  if (input < low) input = low;
  else if (input > high) input = high;
  else input = input;
  return input;
}
function checkLinearLimitVelocity(vel) {
  vel = constrain(vel, -ROBOT_MAX_LIN_VEL, ROBOT_MAX_LIN_VEL);
  return vel;
}
function checkAngularLimitVelocity(vel) {
  vel = constrain(vel, -ROBOT_MAX_ANG_VEL, ROBOT_MAX_ANG_VEL);
  return vel;
}
$(document).ready(function () {
  var moveCommands = {
    forward: function () {
      target_linear_vel = checkLinearLimitVelocity(
        target_linear_vel + ROBOT_LINEAR_VEL_STEP_SIZE
      );
      control_linear_vel = makeSimpleProfile(
        control_linear_vel,
        target_linear_vel,
        ROBOT_LINEAR_VEL_STEP_SIZE / 2.0
      );
      control_angular_vel = makeSimpleProfile(
        control_angular_vel,
        target_angular_vel,
        ROBOT_ANGULAR_VEL_STEP_SIZE / 2.0
      );
      move(control_linear_vel, control_angular_vel);
    },
    backward: function () {
      target_linear_vel = checkLinearLimitVelocity(
        target_linear_vel - ROBOT_LINEAR_VEL_STEP_SIZE
      );
      control_linear_vel = makeSimpleProfile(
        control_linear_vel,
        target_linear_vel,
        ROBOT_LINEAR_VEL_STEP_SIZE / 2.0
      );
      control_angular_vel = makeSimpleProfile(
        control_angular_vel,
        target_angular_vel,
        ROBOT_ANGULAR_VEL_STEP_SIZE / 2.0
      );
      move(control_linear_vel, control_angular_vel);
    },
    stop: function () {
      target_linear_vel = 0.0;
      control_linear_vel = 0.0;
      target_angular_vel = 0.0;
      control_angular_vel = 0.0;
      move(control_linear_vel, control_angular_vel);
    },
    turnLeft: function () {
      target_angular_vel = checkAngularLimitVelocity(
        target_angular_vel - ROBOT_ANGULAR_VEL_STEP_SIZE
      );
      control_linear_vel = makeSimpleProfile(
        control_linear_vel,
        target_linear_vel,
        ROBOT_LINEAR_VEL_STEP_SIZE / 2.0
      );
      control_angular_vel = makeSimpleProfile(
        control_angular_vel,
        target_angular_vel,
        ROBOT_ANGULAR_VEL_STEP_SIZE / 2.0
      );
      move(control_linear_vel, control_angular_vel);
    },
    turnRight: function () {
      target_angular_vel = checkAngularLimitVelocity(
        target_angular_vel + ROBOT_ANGULAR_VEL_STEP_SIZE
      );
      control_linear_vel = makeSimpleProfile(
        control_linear_vel,
        target_linear_vel,
        ROBOT_LINEAR_VEL_STEP_SIZE / 2.0
      );
      control_angular_vel = makeSimpleProfile(
        control_angular_vel,
        target_angular_vel,
        ROBOT_ANGULAR_VEL_STEP_SIZE / 2.0
      );
      move(control_linear_vel, control_angular_vel);
    },
  };

  $("#forward").click(function () {
    console.log("button forward clicked");
    moveCommands.forward();
  });
  $("#stop").click(function () {
    console.log("button stop clicked");
    moveCommands.stop();
  });
  $("#backward").click(function () {
    console.log("button backward clicked");
    moveCommands.backward();
  });
  $("#turnLeft").click(function () {
    console.log("button turnLeft clicked");
    moveCommands.turnLeft();
  });
  $("#turnRight").click(function () {
    console.log("button turnRight clicked");
    moveCommands.turnRight();
  });

  $body = $("body");
  var ros = new ROSLIB.Ros({
    url: "ws://localhost:9090",
  });

  // Create the main viewer.
  var viewer = new ROS2D.Viewer({
    divID: "nav",
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
  });

  var gridClient = new NAV2D.OccupancyGridClientNav({
    ros: ros,
    rootObject: viewer.scene,
    viewer: viewer,
    serverName: "/move_base",
    continuous: true,
  });

  var pan = new ROS2D.PanView({
    ros: ros,
    rootObject: viewer.scene,
  });

  window.pane = function (a, b) {
    pan.startPan(a, b);
  };

  window.paned = function (c, d) {
    pan.pan(c, d);
  };

  window.zoomInMap = function (ros, viewer) {
    var zoom = new ROS2D.ZoomView({
      ros: ros,
      rootObject: viewer.scene,
    });
    zoom.startZoom(250, 250);
    zoom.zoom(1.2);
  };

  window.zoomOutMap = function (ros, viewer) {
    var zoom = new ROS2D.ZoomView({
      ros: ros,
      rootObject: viewer.scene,
    });
    zoom.startZoom(250, 250);
    zoom.zoom(0.8);
  };

  $("#zoomplus").click(function (event) {
    event.preventDefault();
    zoomInMap(ros, viewer);
  });

  $("#zoomminus").click(function (event) {
    event.preventDefault();
    zoomOutMap(ros, viewer);
  });

  $("#savemap").click(function (event) {
    event.preventDefault();

    var mapname = prompt("Please enter the name of the map");

    if (mapname) {
      $.ajax({
        url: "/mapping/savemap",
        type: "POST",
        data: mapname,
        success: function (response) {
          window.location = "/mapping";
          console.log(response);
        },
        error: function (error) {
          console.log(error);
        },
      });
    } else {
      alert("enter valid mapname to save");
    }
  });

  cmd_vel_listener = new ROSLIB.Topic({
    ros: ros,
    name: "/cmd_vel",
    messageType: "geometry_msgs/Twist",
  });

  move = function (linear, angular) {
    var twist = new ROSLIB.Message({
      linear: {
        x: linear,
        y: 0,
        z: 0,
      },
      angular: {
        x: 0,
        y: 0,
        z: angular,
      },
    });
    console.log(linear,angular)
    cmd_vel_listener.publish(twist);
  };

  createJoystick = function () {
    var options = {
      zone: document.getElementById("zonejoystick"),
      threshold: 0.1,
      position: { right: "8%", bottom: "20%" },
      mode: "static",
      size: 150,
      color: "blue",
    };
    manager = nipplejs.create(options);

    linear_speed = 0;
    angular_speed = 0;

    manager.on("start", function (event, nipple) {
      timer = setInterval(function () {
        move(linear_speed, angular_speed);
      }, 25);
    });

    manager.on("move", function (event, nipple) {
      max_linear = 0.22; // m/s
      max_angular = 0.8; // rad/s
      max_distance = 75.0; // pixels;
      linear_speed =
        (Math.sin(nipple.angle.radian) * max_linear * nipple.distance) /
        max_distance;
      angular_speed =
        (-Math.cos(nipple.angle.radian) * max_angular * nipple.distance) /
        max_distance;
    });

    manager.on("end", function () {
      if (timer) {
        clearInterval(timer);
      }
      self.move(0, 0);
    });
  };

  // window.onload = function () {
  //   createJoystick();
  // };

  $(".menu-btn").click(function () {
    $(this).toggleClass("menu-btn-left");
    $(".box-out").toggleClass("box-in");
  });

  $("#start-nav-button").click(function () {
    event.preventDefault();
  });

  $("#index-list-map").click(function (event) {
    document.cookie = event.target.innerHTML;
    $("#exampleModal").modal("hide");
    $.ajax({
      url: "/mapping/cutmapping",
      type: "POST",
      success: function (response) {
        $.ajax({
          url: "/index/navigation-precheck",
          type: "GET",
          success: function (response) {
            console.log(response.mapcount);
            if (response.mapcount > 0) {
              $body.addClass("loading");
              $.ajax({
                url: "/index/gotonavigation",
                type: "POST",
                data: event.target.innerHTML,
                success: function (response) {
                  // console.log(response)

                  var rosTopic = new ROSLIB.Topic({
                    ros: ros,
                    name: "/rosout_agg",
                    messageType: "rosgraph_msgs/Log",
                  });

                  rosTopic.subscribe(function (message) {
                    // console.log(message.msg)
                    if (message.msg == "odom received!") {
                      console.log(message.msg);
                      window.location = "/navigation";
                      $body.removeClass("loading");
                      // window.location = "/navigation";
                    }
                  });
                },
                error: function (error) {
                  console.log(error);
                },
              });
            } else {
              alert("No map in directory.Please do mapping.");
            }
          },
          error: function (error) {
            console.log(error);
          },
        });
      },
      error: function (error) {
        console.log(error);
      },
    });
  });
});
