from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_mysqldb import MySQL
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
import threading
import time
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from MySQLdb.cursors import DictCursor

# =========================
# APP CONFIG
# =========================
app = Flask(__name__)
app.secret_key = "super_secret_key"

# =========================
# MYSQL CONFIG
# =========================
app.config["MYSQL_HOST"] = "localhost"
app.config["MYSQL_USER"] = "root"
app.config["MYSQL_PASSWORD"] = "root"
app.config["MYSQL_DB"] = "parksmart"

mysql = MySQL(app)

# =========================
# SMTP CONFIG (BREVO)
# =========================
SMTP_SERVER = "smtp-relay.brevo.com"
SMTP_PORT = 587
SMTP_LOGIN = "9dfb28001@smtp-brevo.com"
SMTP_PASSWORD = "xsmtpsib-2f350dc267227830a62ad40bc171bca264f62ec4ac43c1dc423cbad34295d022-4HEncMv93PrIfiwQ"
SENDER_EMAIL = "kartikbagde446@gmail.com"

# =========================
# LOGIN REQUIRED DECORATOR
# =========================
def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if "username" not in session:
            flash("Please login first")
            return redirect(url_for("login"))
        return func(*args, **kwargs)
    return wrapper

# =========================
# AUTO EXPIRE BOOKINGS
# =========================
@app.before_request
def expire_slots():
    try:
        cur = mysql.connection.cursor()
        for table in [
            "ghr_wadi_bookings",
            "ghr_sadar_bookings",
            "ghr_dighdoh_bookings"
        ]:
            cur.execute(f"""
                UPDATE {table}
                SET status='EXPIRED'
                WHERE expiry_time < NOW()
                AND status='ACTIVE'
            """)
        mysql.connection.commit()
        cur.close()
    except Exception as e:
        print("Expire error:", e)

# =========================
# AUTH ROUTES
# =========================
@app.route("/", methods=["GET"])
def root():
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        cur = mysql.connection.cursor()
        cur.execute("SELECT * FROM users WHERE username=%s", (username,))
        user = cur.fetchone()
        cur.close()

        if user and check_password_hash(user[4], password):
            session["user_id"] = user[0]
            session["username"] = user[1]
            session["phone"] = user[2]
            session["email"] = user[3]
            return redirect(url_for("main"))

        flash("Invalid credentials")

    return render_template("login.html")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form["username"]
        phone = request.form["phone"]
        email = request.form["email"]
        password = request.form["password"]

        cur = mysql.connection.cursor()
        cur.execute("SELECT id FROM users WHERE email=%s", (email,))
        if cur.fetchone():
            flash("Email already registered")
            return redirect(url_for("signup"))

        cur.execute("""
            INSERT INTO users (username, phone, email, password)
            VALUES (%s, %s, %s, %s)
        """, (username, phone, email, generate_password_hash(password)))
        mysql.connection.commit()
        cur.close()

        flash("Account created successfully")
        return redirect(url_for("login"))

    return render_template("signup.html")

@app.route("/logout")
def logout():
    session.clear()
    flash("Logged out successfully")
    return redirect(url_for("login"))

# =========================
# MAIN & STATIC PAGES
# =========================
@app.route("/main")
@login_required
def main():
    return render_template(
        "main.html",
        username=session["username"],
        email=session["email"],
        phone=session["phone"]
    )

@app.route("/index")
@login_required
def index():
    return render_template("index.html")

@app.route("/search_location")
@login_required
def search_location():
    return render_template("search_location.html")

# =========================
# CAMPUS ROUTES
# =========================
@app.route("/ghr_wadi")
@login_required
def ghr_wadi():
    return render_template("ghr_wadi.html")

@app.route("/ghr_sadar")
@login_required
def ghr_sadar():
    return render_template("ghr_sadar.html")

@app.route("/ghr_dighdoh")
@login_required
def ghr_dighdoh():
    return render_template("ghr_dighdoh.html")

@app.route("/booking", methods=["GET", "POST"])
def booking():
    if "user_id" not in session:
        flash("Please login first", "error")
        return redirect(url_for("login"))

    if request.method == "POST":
        vehicle_number = request.form["vehicle_number"]
        location = request.form["location"]
        start_time = request.form["start_time"]
        end_time = request.form["end_time"]

        booked_at = datetime.now()
        booking_id = str(uuid.uuid4())[:8]

        cur = mysql.connection.cursor()
        cur.execute("""
            INSERT INTO bookedperson
            (name, vehicle_number, location, start_time, end_time, booking_id, booked_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            session["username"], 
            vehicle_number,
            location,
            start_time,
            end_time,
            booking_id,
            booked_at
        ))
        mysql.connection.commit()
        cur.close()

        send_booking_email(
            session["email"],
            session["username"],
            location,
            start_time,
            end_time,
            booking_id
        )

        flash("Booking confirmed! Confirmation email sent.", "success")
        return redirect(url_for("booking"))

    return render_template("booking.html")





def send_booking_email(email, username, location, start_time, end_time, booking_id):
    subject = "🚗 ParkSmart Booking Confirmed"

    html_content = f"""
    <h2>Hello {username},</h2>
    <p>Your parking spot has been successfully booked.</p>

    <ul>
        <li><strong>Location:</strong> {location}</li>
        <li><strong>Start Time:</strong> {start_time}</li>
        <li><strong>End Time:</strong> {end_time}</li>
        <li><strong>Booking ID:</strong> {booking_id}</li>
    </ul>

    <p>Thank you for using <b>ParkSmart</b>!</p>
    """

    # brevo SMTP code here (already working in your project)



# =========================
# HELPER FUNCTION
# =========================
def get_table_name(campus):
    return {
        "gh raisoni wadi": "ghr_wadi_bookings",
        "gh raisoni sadar": "ghr_sadar_bookings",
        "gh raisoni dighdoh": "ghr_dighdoh_bookings"
    }.get(campus.lower())

# =========================
# BOOK SLOT
# =========================
@app.route("/book_slot", methods=["POST"])
@login_required
def book_slot():
    data = request.json
    slot_id = data["slot_id"]
    campus = data["campus"]

    table = get_table_name(campus)
    cur = mysql.connection.cursor()

    cur.execute(f"""
        SELECT id FROM {table}
        WHERE slot_id=%s
        AND status='ACTIVE'
        AND expiry_time > NOW()
    """, (slot_id,))

    if cur.fetchone():
        return jsonify({"status": "error", "message": "Slot already booked"})

    booked_at = datetime.now()
    expiry_time = booked_at + timedelta(hours=1)

    cur.execute(f"""
        INSERT INTO {table}
        (slot_id, username, phone, campus, booked_at, expiry_time, status, reminder_sent)
        VALUES (%s,%s,%s,%s,%s,%s,'ACTIVE',0)
    """, (
        slot_id,
        session["username"],
        session["phone"],
        campus,
        booked_at,
        expiry_time
    ))
    mysql.connection.commit()
    cur.close()

    send_booking_email(
        session["email"],
        session["username"],
        slot_id,
        campus,
        booked_at,
        expiry_time
    )

    return jsonify({
        "status": "success",
        "expiry_time": expiry_time.strftime("%Y-%m-%d %H:%M:%S")
    })

# =========================
# GET BOOKED SLOTS
# =========================
@app.route("/get_booked_slots", methods=["POST"])
@login_required
def get_booked_slots():
    campus = request.json["campus"]
    table = get_table_name(campus)

    cur = mysql.connection.cursor()
    cur.execute(f"""
        SELECT slot_id FROM {table}
        WHERE status='ACTIVE'
        AND expiry_time > NOW()
    """)
    slots = [row[0] for row in cur.fetchall()]
    cur.close()

    return jsonify(slots)

# =========================
# DASHBOARD
# =========================
@app.route("/dashboard")
@login_required
def dashboard():
    cur = mysql.connection.cursor(DictCursor)
    cur.execute("""
        SELECT slot_id, booked_at, expiry_time, status, 'Dighdoh' AS campus
        FROM ghr_dighdoh_bookings WHERE username=%s
        UNION ALL
        SELECT slot_id, booked_at, expiry_time, status, 'Wadi'
        FROM ghr_wadi_bookings WHERE username=%s
        UNION ALL
        SELECT slot_id, booked_at, expiry_time, status, 'Sadar'
        FROM ghr_sadar_bookings WHERE username=%s
    """, (session["username"],)*3)
    bookings = cur.fetchall()
    cur.close()

    return render_template("dashboard.html", bookings=bookings)

# =========================
# EMAIL FUNCTIONS
# =========================
def send_booking_email(to_email, username, slot_id, campus, booked_at, expiry_time):
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"ParkSmart <{SENDER_EMAIL}>"
        msg["To"] = to_email
        msg["Subject"] = "🚗 ParkSmart Booking Confirmation"

        html = f"""
        <h2>Slot Booked Successfully</h2>
        <p>Hello {username},</p>
        <p><b>Campus:</b> {campus}</p>
        <p><b>Slot:</b> {slot_id}</p>
        <p><b>Expires:</b> {expiry_time}</p>
        """

        msg.attach(MIMEText(html, "html"))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_LOGIN, SMTP_PASSWORD)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        server.quit()

    except Exception as e:
        print("Email error:", e)

# =========================
# REMINDER THREAD
# =========================
def reminder_checker():
    with app.app_context():
        while True:
            try:
                cur = mysql.connection.cursor()
                now = datetime.now()
                window = now + timedelta(minutes=10)

                for table in ["ghr_wadi_bookings", "ghr_sadar_bookings", "ghr_dighdoh_bookings"]:
                    cur.execute(f"""
                        SELECT id, username, slot_id, campus, expiry_time
                        FROM {table}
                        WHERE expiry_time BETWEEN %s AND %s
                        AND reminder_sent=0
                    """, (now, window))

                    for row in cur.fetchall():
                        cur.execute(f"""
                            UPDATE {table}
                            SET reminder_sent=1
                            WHERE id=%s
                        """, (row[0],))
                        mysql.connection.commit()

                cur.close()
            except Exception as e:
                print("Reminder error:", e)

            time.sleep(60)

threading.Thread(target=reminder_checker, daemon=True).start()

# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)
