use std::collections::HashSet;
use std::path::Path;

pub(crate) fn is_command_allowed(command: &str, args: &[String]) -> bool {
    let allowed_commands: HashSet<&str> = [
        "echo", "ls", "cat", "pwd", "git", "node", "npm", "cargo", "python", "python3",
    ]
    .iter()
    .cloned()
    .collect();

    if !allowed_commands.contains(command) {
        return false;
    }

    let dangerous_args: HashSet<&str> = ["-e", "-c", "--eval", "-exec", "--execute"]
        .iter()
        .cloned()
        .collect();

    for arg in args {
        if dangerous_args.contains(arg.as_str()) {
            return false;
        }
        if arg.starts_with("-e=") || arg.starts_with("-c=") {
            return false;
        }
    }

    true
}

pub(crate) fn is_path_safe(path: &str) -> bool {
    let path = Path::new(path);

    if path.is_absolute() {
        if let Some(home_dir) = dirs::home_dir() {
            let allowed_dirs = [
                home_dir.join("Documents"),
                home_dir.join("Desktop"),
                home_dir.join("Downloads"),
            ];

            for allowed_dir in allowed_dirs {
                if path.starts_with(&allowed_dir) {
                    return true;
                }
            }
            return false;
        }
    }

    true
}
