import os

# Base Path
base_path = "/home/justin/Desktop/DS/IES_Syllabus_Data"

# Curriculum Structure (Derived from dataset.txt)
curriculum = {
    "Department of Civil Engineering": {
        "Semester 1": ["Mathematics for Physical Science 1", "Physics", "Mechanics", "Intro to Civil", "Python"],
        "Semester 2": ["Mathematics 2", "Chemistry", "Graphics", "Workshop"],
        "Semester 3": ["Partial Differential Eq", "Mechanics of Solids", "Fluid Mechanics", "Surveying"],
        "Semester 4": ["Probability & Statistics", "Geology", "Geotechnical Eng I", "Transportation Eng"],
        "Semester 5": ["Structural Analysis I", "Design of Concrete", "Geotechnical Eng II", "Hydrology"],
        "Semester 6": ["Structural Analysis II", "Environmental Eng", "Hydraulic Structures"],
        "Semester 7": ["Design of Steel Structures", "Safety Eng", "Elective - Prestressed Concrete", "Elective - Ground Improvement"],
        "Semester 8": ["Quantity Surveying", "Elective - Earthquake Resistant Design"]
    },
    "Department of Computer Science": {
        "Semester 1": ["Discrete Math", "Physics", "Graphics", "Basic Electrical", "Python"],
        "Semester 2": ["Calculus", "Chemistry", "Electronics", "C Programming"],
        "Semester 3": ["Discrete Structures", "Data Structures", "Logic System Design", "OOPS Java"],
        "Semester 4": ["Graph Theory", "Computer Org", "DBMS", "Operating Systems"],
        "Semester 5": ["Automata Theory", "Networks", "System Software", "Microprocessors"],
        "Semester 6": ["Compiler Design", "Computer Graphics", "Algorithm Analysis"],
        "Semester 7": ["Artificial Intelligence", "Elective - Machine Learning", "Elective - Cloud Computing"],
        "Semester 8": ["Distributed Computing", "Elective - Deep Learning", "Elective - Big Data"]
    },
    "Department of Electronics & Communication": {
        "Semester 1": ["Maths for Electrical Sc", "Physics", "EEE Basics", "Python"],
        "Semester 3": ["Solid State Devices", "Logic Circuit Design", "Network Theory"],
        "Semester 4": ["Analog Circuits", "Signals and Systems", "Computer Arch"],
        "Semester 5": ["Linear Integrated Circuits", "DSP", "Analog Digital Comm", "Control Systems"],
        "Semester 6": ["Electromagnetics", "VLSI Design", "Information Theory"],
        "Semester 7": ["Microwaves and Antennas", "Elective - Embedded Systems"],
        "Semester 8": ["Wireless Communication", "Elective - Pattern Recognition"]
    },
    "Department of Electrical & Electronics": {
        "Semester 1": ["Maths for Electrical Sc", "Physics", "EEE Basics", "Python"],
        "Semester 3": ["Circuits and Networks", "Measurements", "Analog Electronics"],
        "Semester 4": ["DC Machines", "Electromagnetic Theory", "Digital Electronics"],
        "Semester 5": ["Power Systems I", "Microprocessors", "Signals and Systems", "Synchronous Machines"],
        "Semester 6": ["Control Systems", "Power Systems II", "Power Electronics"],
        "Semester 7": ["Advanced Control Systems"],
        "Semester 8": ["Electrical System Design"]
    },
    "Department of Mechanical Engineering": {
        "Semester 1": ["Maths for Physical Sc", "Physics", "Mechanics", "Intro to Mech", "Python"],
        "Semester 3": ["Mechanics of Solids", "Mechanics of Fluids", "Metallurgy"],
        "Semester 4": ["Thermodynamics", "Manufacturing Process", "Fluid Machinery"],
        "Semester 5": ["Mechanics of Machinery", "Thermal Eng", "Industrial Eng", "Machine Tools"],
        "Semester 6": ["Heat Mass Transfer", "Dynamics of Machinery", "Advanced Manufacturing"],
        "Semester 7": ["Machine Elements", "Elective - Advanced Fluid"],
        "Semester 8": ["Mechatronics"]
    },
    "Department of Robotics & AI": {
        "Semester 1": ["Maths for Electrical", "Physics", "Python", "Graphics"],
        "Semester 3": ["Processing Materials", "Electronic Devices", "Digital Electronics"],
        "Semester 4": ["Kinematics Dynamics", "Manufacturing", "Embedded Systems"],
        "Semester 5": ["Intro to Robotics", "Solid Mechanics", "Industrial Automation"],
        "Semester 6": ["Advanced Control for Robotics", "Mobile Robotics"],
        "Semester 7": ["Algorithms and Data Structures"],
        "Semester 8": ["AI and Machine Learning"]
    }
}

for dept, sems in curriculum.items():
    for sem, subjects in sems.items():
        for subject in subjects:
            # Create Path: Base / Dept / Sem / Subject
            path = os.path.join(base_path, dept, sem, subject)
            os.makedirs(path, exist_ok=True)
            # Create a placeholder text file so the folder isn't empty (optional)
            with open(os.path.join(path, "resources.txt"), "w") as f:
                f.write(f"Upload notes for {subject} here.")

print(f"✅ Created folder structure at {base_path}")
