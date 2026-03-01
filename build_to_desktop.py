import os
import sys
import subprocess
import shutil
import platform

def run_command(command, description):
    print(f"Running: {description}...")
    try:
        subprocess.check_call(command, shell=True)
    except subprocess.CalledProcessError as e:
        print(f"Error during {description}: {e}")
        sys.exit(1)

def main():
    project_name = "BlockDrop"
    # User specifically asked for .exe extension in their prompt
    output_filename = f"{project_name}.exe" 
    
    # 1. Prerequisites: Check PyInstaller
    try:
        import PyInstaller
        print("PyInstaller is already installed.")
    except ImportError:
        run_command(f"{sys.executable} -m pip install pyinstaller", "Installing PyInstaller")

    # 2. Compilation
    print("Compiling project with PyInstaller (this may take a minute)...")
    # --onefile: single executable
    # --noconsole: no terminal window (applies to GUI apps)
    # --name: set the output filename
    build_cmd = f"pyinstaller --onefile --noconsole --name {project_name} main.py"
    run_command(build_cmd, "Building Standalone Executable")

    # 3. Locate Desktop
    desktop_path = os.path.join(os.path.expanduser('~'), 'Desktop')
    
    # 4. Automated Deployment
    # PyInstaller puts the result in 'dist'
    dist_folder = os.path.join(os.getcwd(), 'dist')
    
    # Handle Mac vs Windows binary naming in 'dist'
    # By default --name SurferPlanPro creates 'dist/SurferPlanPro' or 'dist/SurferPlanPro.exe'
    source_binary = os.path.join(dist_folder, project_name)
    if os.path.exists(source_binary + ".exe"):
        source_binary += ".exe"
    
    if not os.path.exists(source_binary):
        # On Mac, it might be a .app folder if something went different, 
        # but with --onefile it should be a single binary.
        print(f"Searching for binary in {dist_folder}...")
        for f in os.listdir(dist_folder):
            if f.startswith(project_name):
                source_binary = os.path.join(dist_folder, f)
                break

    if os.path.exists(source_binary):
        target_path = os.path.join(desktop_path, output_filename)
        print(f"Moving executable to Desktop: {target_path}")
        if os.path.exists(target_path):
            os.remove(target_path)
        shutil.move(source_binary, target_path)
        print("Success! Executable is on your Desktop.")
    else:
        print(f"Could not find the built binary in {dist_folder}")

    # 5. Cleanup
    print("Cleaning up temporary build files...")
    build_folder = os.path.join(os.getcwd(), 'build')
    spec_file = os.path.join(os.getcwd(), f"{project_name}.spec")
    
    if os.path.exists(build_folder):
        shutil.rmtree(build_folder)
    if os.path.exists(dist_folder):
        shutil.rmtree(dist_folder)
    if os.path.exists(spec_file):
        os.remove(spec_file)
        
    print("Cleanup complete. Enjoy Surfer Plan Pro!")

if __name__ == "__main__":
    main()
