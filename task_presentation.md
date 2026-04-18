# 🎓 Task-by-Task Presentation Guide

This version of your presentation is structured **directly against your rubric**. When presenting, simply name the task from the assignment, tell the professor how you solved it, and run the command to prove it in the terminal.

> **Setup:** Open your VS Code built-in Git Bash terminal inside `DevOps Project`.

---

## Task 1: "Break it into services (auth, student, results)"

**What to Say:**
> *"The first objective was taking a single monolithic app and splitting it by Bounded Context. I created three entirely independent services: **Auth**, **Student**, and **Results**. To ensure they are truly decoupled, I didn't just put them in different folders—I gave each service its own dedicated MongoDB database. You can see this in my project structure: three folders, three `main.py` files, and three `requirements.txt` files."*

**How to Prove It (Terminal Command):**
*List your folders to physically show the separation.*
```bash
ls -d *-service
```
*(Point out the `auth-service`, `results-service`, and `student-service` directories).*

---

## Task 2: "Containerize each service using Docker"

**What to Say:**
> *"Next, I had to containerize them. I wrote a `Dockerfile` for each Python service using `python:3.11-slim` to keep the footprint small. Rather than running 6 manual Docker commands, I orchestrated the entire ecosystem using a `docker-compose.yml` file. This allows me to spin up all 3 APIs and all 3 Mongo databases simultaneously.*
> *Let me demonstrate."*

**How to Prove It (Terminal Command):**
**1. Run the build command:**
```bash
docker-compose up --build -d
```
*(Let the professor watch the logs spin up).*

**2. Show that they are running in isolated containers:**
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
> *"As you can see, we have exactly 6 distinct containers running right now. `erp_auth`, `erp_student`, and `erp_results` are each running their own isolated environment."*

---

## Task 3: "Enable communication between containers"

**What to Say:**
> *"Finally, the most challenging part: Inter-container communication. My containers are on a custom bridge network called `erp_network`. They don't use 'localhost' to talk to each other; they use internal Docker DNS."*
> *"I built a security checkpoint: If someone tries to add a student, the **Student container** must internally pause and make a background HTTP call to the **Auth container** to verify their token. Let me prove this live."*

**How to Prove It (Live Demo):**

**Step A: Get a Token from the Auth Container**
```bash
# Register the admin user (necessary after docker-compose down -v wipes the database)
curl -s -X POST http://localhost:8001/register -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"pass123\",\"role\":\"admin\"}"

# Now login to get the session token
TOKEN=$(curl -s -X POST http://localhost:8001/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"pass123\"}" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Token Acquired securely from Auth!"
```

**Step B: The Microservice Handshake**
*Run this command to send data to the Student container using the token.*
```bash
curl -s -X POST http://localhost:8002/students -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"Arjun\",\"roll_number\":\"CS001\",\"department\":\"CS\",\"year\":2}"
```
*(You will see a successful response message.)*

**Step C: The Ultimate Proof (Docker Logs)**
> *"To prove that the Student container actually reached out to the Auth container across the Docker network to verify the token, let's look at the Auth container's network logs."*

```bash
docker logs erp_auth --tail 5
```
*(You will see a log line that looks like `GET /verify-token HTTP/1.1" 200 OK`).*

> *"Right there, you can see the `/verify-token` hit. I sent my data to port 8002 (Student), but we see the traffic show up inside the Auth container logs. This proves undeniable, secure inter-container communication!"*

---

## Clean Up

**What to Say:**
> *"And to finish, I will gracefully terminate all services and destroy the bridge network."*

```bash
docker-compose down
```
> *"Thank you."*
