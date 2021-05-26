from flask import Blueprint, render_template, url_for, g, jsonify, request
from flask_login import login_required, current_user
import subprocess
from sqlite3 import Error
import subprocess
import signal
import os
import time
import sqlite3


main = Blueprint('main', __name__)


DATABASE = os.path.join(os.getcwd(), "project\\static", "database.db")


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    return db


# @main.teardown_appcontext
# def close_connection(exception):
#     db = getattr(g, '_database', None)
#     if db is not None:
#         db.close()

@main.before_app_first_request
def create_table():

   # subprocess.Popen(["roslaunch", "robot_rtabmap", "robot_bringup.launch"])
    data = get_db().cursor()
    data.execute(
        "CREATE TABLE IF NOT EXISTS maps (id integer PRIMARY KEY,name text NOT NULL)")
    data.close()


@main.route('/robot')
@login_required
def index():
    with get_db():
        try:
            c = get_db().cursor()
            c.execute("SELECT * FROM maps")
            data = c.fetchall()
            c.close()
        except Error as e:
            print(e)

    return render_template('robot.html', title='Index', map=data)


@main.route('/robot')
@login_required
def robot():
    return render_template('robot.html', name=current_user.name)


@main.route('/navigation', methods=['GET', 'POST'])
@login_required
def navigation():

    with get_db():
        try:
            c = get_db().cursor()
            c.execute("SELECT * FROM maps")
            data = c.fetchall()
            c.close()
        except Error as e:
            print(e)
    return render_template('navigation.html', map=data)


@main.route("/navigation/<variable>", methods=['GET', 'POST'])
@login_required
def gotomapping(variable):
    if variable == "index":
        roslaunch_process.start_mapping()
    elif variable == "gotomapping":
        roslaunch_process.stop_navigation()
        time.sleep(2)
        roslaunch_process.start_mapping()
    return "success"


@main.route("/navigation/loadmap", methods=['POST'])
def navigation_properties():

    mapname = request.get_data().decode('utf-8')

    roslaunch_process.stop_navigation()
    time.sleep(5)
    roslaunch_process.start_navigation(mapname)
    return("success")


@main.route("/navigation/stop", methods=['POST'])
@login_required
def stop():
    os.system("rostopic pub /move_base/cancel actionlib_msgs/GoalID -- {}")
    return("stopped the robot")


@main.route('/mapping')
@login_required
def mapping():
    with get_db():
        try:
            c = get_db().cursor()
            c.execute("SELECT * FROM maps")
            data = c.fetchall()
            c.close()
        except Error as e:
            print(e)

    return render_template('mapping.html', title='Mapping', map=data)


@main.route("/mapping/cutmapping", methods=['POST'])
@login_required
def killnode():
    roslaunch_process.stop_mapping()
    return("killed the mapping node")


@main.route("/mapping/savemap", methods=['POST'])
@login_required
def savemap():
    mapname = request.get_data().decode('utf-8')

    os.system("rosrun map_server map_saver -f"+" " +
              os.path.join(os.getcwd(), "static", mapname))
    os.system("convert"+" "+os.getcwd()+"/static/"+mapname +
              ".pgm"+" "+os.getcwd()+"/static/"+mapname+".png")

    with get_db():
        try:
            c = get_db().cursor()
            c.execute("insert into maps (name) values (?)", (mapname,))
            # get_db().commit()
            c.close()
        except Error as e:
            print(e)

    return("success")


@main.route("/shutdown", methods=['POST'])
@login_required
def shutdown():
    os.system("shutdown now")
    return("shutting down the robot")


@main.route('/navigation/deletemap', methods=['POST'])
@login_required
def deletemap():
    mapname = request.get_data().decode('utf-8')
    print(mapname)
    os.system("rm -rf"+" "+os.getcwd()+"/static/"+mapname+".yaml "+os.getcwd() +
              "/static/"+mapname+".png "+os.getcwd()+"/static/"+mapname+".pgm")

    with get_db():
        try:
            c = get_db().cursor()
            c.execute("DELETE FROM maps WHERE name=?", (mapname,))
            c.close()
        except Error as e:
            print(e)
    return ("successfully deleted map")


@main.route('/robot/<variable>', methods=['GET', 'POST'])
@login_required
def themainroute(variable):
    if variable == "navigation-precheck":

        with get_db():

            try:

                data = get_db().cursor()
                data.execute("SELECT count(*) FROM maps")
                FirstData = data.fetchall()[0][0]
                data.close()
                print(FirstData)
                return jsonify(mapcount=FirstData)

            except Error as e:
                print(e)
    elif variable == "gotonavigation":

        mapname = request.get_data().decode('utf-8')

        roslaunch_process.start_navigation(mapname)

        return "success"


class roslaunch_process():
    @classmethod
    def start_navigation(self, mapname):

        self.process_navigation = subprocess.Popen(
            ["roslaunch", "--wait", "robot_navigation", "robot_navigation.launch", "map_file:="+os.getcwd()+"/static/"+mapname+".yaml"])

    @classmethod
    def stop_navigation(self):
        self.process_navigation.send_signal(signal.SIGINT)

    @classmethod
    def start_mapping(self):

        self.process_mapping = subprocess.Popen(
            ["roslaunch", "--wait", "robot_slam", "robot_slam.launch", "slam_methods:=gmapping"])

    @classmethod
    def stop_mapping(self):

        self.process_mapping.send_signal(signal.SIGINT)
