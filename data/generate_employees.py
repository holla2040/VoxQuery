#!/usr/bin/env python3
"""
Generate mock employee data for VoxQuery demo.
Creates 1000 employees with realistic salary/location distributions.
"""

import csv
import random
from datetime import datetime, timedelta

# Try to use faker, fall back to basic generation if not available
try:
    from faker import Faker
    fake = Faker()
    USE_FAKER = True
except ImportError:
    USE_FAKER = False
    print("Warning: faker not installed. Using basic random generation.")

# 50 US cities with realistic lat/lon coordinates (major metros + small towns)
CITIES = {
    # Major metros (original 10)
    "San Francisco": {"state": "California", "lat": 37.7749, "lon": -122.4194, "weight": 3},
    "Los Angeles": {"state": "California", "lat": 34.0522, "lon": -118.2437, "weight": 3},
    "Seattle": {"state": "Washington", "lat": 47.6062, "lon": -122.3321, "weight": 3},
    "New York": {"state": "New York", "lat": 40.7128, "lon": -74.0060, "weight": 3},
    "Austin": {"state": "Texas", "lat": 30.2672, "lon": -97.7431, "weight": 3},
    "Denver": {"state": "Colorado", "lat": 39.7392, "lon": -104.9903, "weight": 3},
    "Chicago": {"state": "Illinois", "lat": 41.8781, "lon": -87.6298, "weight": 3},
    "Boston": {"state": "Massachusetts", "lat": 42.3601, "lon": -71.0589, "weight": 3},
    "Miami": {"state": "Florida", "lat": 25.7617, "lon": -80.1918, "weight": 3},
    "Portland": {"state": "Oregon", "lat": 45.5152, "lon": -122.6784, "weight": 3},

    # Northeast small towns
    "Burlington": {"state": "Vermont", "lat": 44.4759, "lon": -73.2121, "weight": 1},
    "Montpelier": {"state": "Vermont", "lat": 44.2601, "lon": -72.5754, "weight": 1},
    "Portsmouth": {"state": "New Hampshire", "lat": 43.0718, "lon": -70.7626, "weight": 1},
    "Portland ME": {"state": "Maine", "lat": 43.6591, "lon": -70.2568, "weight": 1},
    "Ithaca": {"state": "New York", "lat": 42.4440, "lon": -76.5019, "weight": 1},
    "Northampton": {"state": "Massachusetts", "lat": 42.3251, "lon": -72.6412, "weight": 1},

    # Southeast small towns
    "Asheville": {"state": "North Carolina", "lat": 35.5951, "lon": -82.5515, "weight": 1},
    "Savannah": {"state": "Georgia", "lat": 32.0809, "lon": -81.0912, "weight": 1},
    "Charleston": {"state": "South Carolina", "lat": 32.7765, "lon": -79.9311, "weight": 1},
    "Key West": {"state": "Florida", "lat": 24.5551, "lon": -81.7800, "weight": 1},
    "Chattanooga": {"state": "Tennessee", "lat": 35.0456, "lon": -85.3097, "weight": 1},
    "Greenville": {"state": "South Carolina", "lat": 34.8526, "lon": -82.3940, "weight": 1},

    # Midwest small towns
    "Madison": {"state": "Wisconsin", "lat": 43.0731, "lon": -89.4012, "weight": 1},
    "Ann Arbor": {"state": "Michigan", "lat": 42.2808, "lon": -83.7430, "weight": 1},
    "Duluth": {"state": "Minnesota", "lat": 46.7867, "lon": -92.1005, "weight": 1},
    "Iowa City": {"state": "Iowa", "lat": 41.6611, "lon": -91.5302, "weight": 1},
    "Lawrence": {"state": "Kansas", "lat": 38.9717, "lon": -95.2353, "weight": 1},
    "Fargo": {"state": "North Dakota", "lat": 46.8772, "lon": -96.7898, "weight": 1},

    # Southwest small towns
    "Santa Fe": {"state": "New Mexico", "lat": 35.6870, "lon": -105.9378, "weight": 1},
    "Sedona": {"state": "Arizona", "lat": 34.8697, "lon": -111.7610, "weight": 1},
    "Flagstaff": {"state": "Arizona", "lat": 35.1983, "lon": -111.6513, "weight": 1},
    "Taos": {"state": "New Mexico", "lat": 36.4072, "lon": -105.5731, "weight": 1},
    "Tucson": {"state": "Arizona", "lat": 32.2226, "lon": -110.9747, "weight": 1},
    "El Paso": {"state": "Texas", "lat": 31.7619, "lon": -106.4850, "weight": 1},

    # Mountain small towns
    "Bozeman": {"state": "Montana", "lat": 45.6770, "lon": -111.0429, "weight": 1},
    "Boulder": {"state": "Colorado", "lat": 40.0150, "lon": -105.2705, "weight": 1},
    "Park City": {"state": "Utah", "lat": 40.6461, "lon": -111.4980, "weight": 1},
    "Jackson": {"state": "Wyoming", "lat": 43.4799, "lon": -110.7624, "weight": 1},
    "Missoula": {"state": "Montana", "lat": 46.8721, "lon": -113.9940, "weight": 1},
    "Durango": {"state": "Colorado", "lat": 37.2753, "lon": -107.8801, "weight": 1},

    # Pacific small towns
    "Bend": {"state": "Oregon", "lat": 44.0582, "lon": -121.3153, "weight": 1},
    "Santa Cruz": {"state": "California", "lat": 36.9741, "lon": -122.0308, "weight": 1},
    "Eureka": {"state": "California", "lat": 40.8021, "lon": -124.1637, "weight": 1},
    "Olympia": {"state": "Washington", "lat": 47.0379, "lon": -122.9007, "weight": 1},
    "Bellingham": {"state": "Washington", "lat": 48.7519, "lon": -122.4787, "weight": 1},
    "Santa Barbara": {"state": "California", "lat": 34.4208, "lon": -119.6982, "weight": 1},

    # Additional diversity cities
    "Reno": {"state": "Nevada", "lat": 39.5296, "lon": -119.8138, "weight": 1},
    "Boise": {"state": "Idaho", "lat": 43.6150, "lon": -116.2023, "weight": 1},
    "Salt Lake City": {"state": "Utah", "lat": 40.7608, "lon": -111.8910, "weight": 2},
    "Albuquerque": {"state": "New Mexico", "lat": 35.0844, "lon": -106.6504, "weight": 2},
}

# Departments with base salary ranges
DEPARTMENTS = {
    "Engineering": {"base_min": 90000, "base_max": 150000, "weight": 30},
    "Product": {"base_min": 85000, "base_max": 140000, "weight": 15},
    "Design": {"base_min": 75000, "base_max": 130000, "weight": 10},
    "Marketing": {"base_min": 60000, "base_max": 110000, "weight": 12},
    "Sales": {"base_min": 55000, "base_max": 120000, "weight": 15},
    "HR": {"base_min": 55000, "base_max": 95000, "weight": 8},
    "Finance": {"base_min": 70000, "base_max": 130000, "weight": 8},
    "Operations": {"base_min": 50000, "base_max": 90000, "weight": 7},
}

# Job titles by department
JOB_TITLES = {
    "Engineering": ["Software Engineer", "Senior Software Engineer", "Staff Engineer",
                    "Engineering Manager", "DevOps Engineer", "Data Engineer"],
    "Product": ["Product Manager", "Senior Product Manager", "Product Director",
                "Technical Product Manager"],
    "Design": ["UX Designer", "Senior UX Designer", "Product Designer", "Design Lead"],
    "Marketing": ["Marketing Manager", "Content Strategist", "Growth Manager",
                  "Marketing Analyst"],
    "Sales": ["Sales Representative", "Account Executive", "Sales Manager",
              "Enterprise Account Executive"],
    "HR": ["HR Specialist", "HR Manager", "Recruiter", "HR Business Partner"],
    "Finance": ["Financial Analyst", "Senior Accountant", "Finance Manager", "Controller"],
    "Operations": ["Operations Manager", "Business Analyst", "Project Manager",
                   "Operations Coordinator"],
}

# First and last names for fallback
FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Margaret", "Anthony", "Betty", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Dorothy", "Paul", "Kimberly", "Andrew", "Emily", "Joshua", "Donna",
    "Kenneth", "Michelle", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
    "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Laura"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
]


def weighted_choice(items_with_weights):
    """Select item based on weight."""
    total = sum(w for _, w in items_with_weights)
    r = random.uniform(0, total)
    cumulative = 0
    for item, weight in items_with_weights:
        cumulative += weight
        if r <= cumulative:
            return item
    return items_with_weights[-1][0]


def generate_employee(employee_id):
    """Generate a single employee record."""

    # Select department based on weights
    dept_items = [(dept, info["weight"]) for dept, info in DEPARTMENTS.items()]
    department = weighted_choice(dept_items)
    dept_info = DEPARTMENTS[department]

    # Select job title
    title = random.choice(JOB_TITLES[department])

    # Select city based on weights (metros get more employees than small towns)
    city_items = [(city, info["weight"]) for city, info in CITIES.items()]
    city = weighted_choice(city_items)
    city_info = CITIES[city]

    # Generate name
    if USE_FAKER:
        first_name = fake.first_name()
        last_name = fake.last_name()
        email_domain = fake.free_email_domain()
    else:
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        email_domain = random.choice(["gmail.com", "yahoo.com", "outlook.com"])

    email = f"{first_name.lower()}.{last_name.lower()}@{email_domain}"

    # Generate hire date (0-10 years ago)
    days_employed = random.randint(30, 3650)
    hire_date = datetime.now() - timedelta(days=days_employed)
    years_tenure = days_employed / 365

    # Calculate salary based on department range + tenure bonus
    base_salary = random.randint(dept_info["base_min"], dept_info["base_max"])
    tenure_bonus = min(years_tenure * 3000, 30000)  # Up to $30k for 10 years

    # Senior titles get 20-40% boost
    if "Senior" in title or "Staff" in title or "Manager" in title or "Director" in title:
        seniority_multiplier = random.uniform(1.2, 1.4)
    else:
        seniority_multiplier = 1.0

    salary = int(base_salary * seniority_multiplier + tenure_bonus)

    # Add slight randomness to coordinates for clustering effect
    lat = city_info["lat"] + random.uniform(-0.05, 0.05)
    lon = city_info["lon"] + random.uniform(-0.05, 0.05)

    # Status (90% active)
    status = "active" if random.random() < 0.9 else "inactive"

    return {
        "employee_id": employee_id,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "department": department,
        "job_title": title,
        "salary": salary,
        "hire_date": hire_date.strftime("%Y-%m-%d"),
        "city": city,
        "state": city_info["state"],
        "latitude": round(lat, 6),
        "longitude": round(lon, 6),
        "status": status,
    }


def main():
    """Generate 1000 employees and save to CSV."""
    random.seed(42)  # For reproducibility

    employees = [generate_employee(i + 1) for i in range(1000)]

    # Write to CSV
    output_file = "employees.csv"
    fieldnames = [
        "employee_id", "first_name", "last_name", "email", "department",
        "job_title", "salary", "hire_date", "city", "state",
        "latitude", "longitude", "status"
    ]

    with open(output_file, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(employees)

    print(f"Generated {len(employees)} employees to {output_file}")

    # Print sample stats
    depts = {}
    cities_count = {}
    for emp in employees:
        depts[emp["department"]] = depts.get(emp["department"], 0) + 1
        cities_count[emp["city"]] = cities_count.get(emp["city"], 0) + 1

    print("\nDepartment distribution:")
    for dept, count in sorted(depts.items(), key=lambda x: -x[1]):
        print(f"  {dept}: {count}")

    print("\nCity distribution:")
    for city, count in sorted(cities_count.items(), key=lambda x: -x[1]):
        print(f"  {city}: {count}")

    salaries = [emp["salary"] for emp in employees]
    print(f"\nSalary range: ${min(salaries):,} - ${max(salaries):,}")
    print(f"Average salary: ${sum(salaries) // len(salaries):,}")


if __name__ == "__main__":
    main()
