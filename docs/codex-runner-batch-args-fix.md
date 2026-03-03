# Codex Windows Runner: `batch file arguments are invalid` Fix Plan

## Root cause

Codex Desktop is launching shell commands through `*.cmd` wrappers (for example `powershell.cmd` and `cmd.cmd`) instead of launching the underlying `*.exe` directly.

Evidence on this machine:

- Wrapper files exist in install resources and forward with `%*`:
  - `C:\Users\slemi\AppData\Local\Programs\Codex\resources\powershell.cmd`
  - `C:\Users\slemi\AppData\Local\Programs\Codex\resources\cmd.cmd`
- Codex logs repeatedly show:
  - `codex_core::exec: exec error: batch file arguments are invalid`
- The exact error string is embedded in `codex.exe` and maps to Rust stdlib Windows batch spawning path (`cmd.exe /e:ON /v:OFF /d /c ...`).

Most likely failure mode:

1. Runner resolves shell program name to a `.cmd` shim on PATH.
2. Runner passes user command arguments (including shell syntax such as `;`, `|`, quotes, etc.).
3. Rust batch argument guard rejects the argument vector before shell execution.
4. User sees `InvalidInput("batch file arguments are invalid")` for many/most commands.

## Patch (exact pseudocode)

### 1) Never spawn `.cmd`/`.bat` as the shell host

```rust
fn resolve_shell_program(shell_kind: ShellKind) -> Result<PathBuf, ExecError> {
    match shell_kind {
        ShellKind::PowerShell => {
            // Prefer pwsh, fall back to Windows PowerShell EXE only.
            first_existing(&[
                r"C:\Program Files\PowerShell\7\pwsh.exe",
                r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            ]).ok_or(ExecError::ShellNotFound("powershell exe"))
        }
        ShellKind::Cmd => {
            let comspec = std::env::var_os("ComSpec")
                .map(PathBuf::from)
                .filter(|p| p.extension().map(|e| e.eq_ignore_ascii_case("exe")).unwrap_or(false))
                .filter(|p| p.is_file());

            Ok(comspec.unwrap_or_else(|| PathBuf::from(r"C:\Windows\System32\cmd.exe")))
        }
    }
}

fn reject_batch_host(path: &Path) -> Result<(), ExecError> {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        if ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat") {
            return Err(ExecError::UnsupportedShellHost {
                message: "Shell host must be .exe on Windows (batch host rejected)".into(),
                host: path.display().to_string(),
            });
        }
    }
    Ok(())
}
```

### 2) PowerShell command transport: use `-EncodedCommand`

This avoids quoting/escaping breakage for spaces, semicolons, pipes, and nested quotes.

```rust
fn encode_ps_command_utf16le_base64(script: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let mut bytes = Vec::with_capacity(script.len() * 2);
    for unit in script.encode_utf16() {
        bytes.push((unit & 0x00FF) as u8);
        bytes.push((unit >> 8) as u8);
    }
    STANDARD.encode(bytes)
}

fn build_powershell_args(script: &str, login: bool) -> Vec<String> {
    let mut args = vec!["-NoLogo".into(), "-NonInteractive".into()];
    if !login {
        args.push("-NoProfile".into());
    }
    args.push("-ExecutionPolicy".into());
    args.push("Bypass".into());
    args.push("-EncodedCommand".into());
    args.push(encode_ps_command_utf16le_base64(script));
    args
}
```

### 3) Build command with argv vector only (no manual shell wrapping)

```rust
fn spawn_windows_shell(req: ExecRequest) -> Result<Output, ExecError> {
    let host = resolve_shell_program(req.shell_kind)?;
    reject_batch_host(&host)?;

    let mut cmd = std::process::Command::new(&host);
    cmd.current_dir(&req.cwd); // pass PathBuf; do not quote cwd manually

    match req.shell_kind {
        ShellKind::PowerShell => cmd.args(build_powershell_args(&req.command, req.login)),
        ShellKind::Cmd => {
            // host is cmd.exe, not cmd.cmd
            cmd.args(["/d", "/s", "/c", &req.command]);
        }
    };

    apply_env(&mut cmd, &req.env);
    run_with_capture(cmd)
}
```

### 4) Optional hardening for shim-heavy environments

If PATH resolution ever returns batch hosts, canonicalize to executable hosts:

- `...\powershell.cmd` -> `...\WindowsPowerShell\v1.0\powershell.exe`
- `...\cmd.cmd` -> `ComSpec` or `C:\Windows\System32\cmd.exe`

## Tests

Minimal Windows regression matrix (table-driven tests):

1. Simple command
- Shell: PowerShell
- login: true, false
- cwd: `C:\Users\slemi\Documents\D.ink`
- command: `echo test`
- expect: exit `0`, stdout contains `test`

2. PowerShell compound command
- Shell: PowerShell
- login: true, false
- cwd: `C:\Users\slemi\Documents\D.ink`
- command: `Get-Location; Get-ChildItem | Select-Object -First 1`
- expect: exit `0`, stdout contains cwd + at least one item line

3. `cmd /c` fallback command
- Shell: Cmd
- login: true, false
- cwd: `C:\Users\slemi\Documents\D.ink`
- command: `echo test`
- expect: exit `0`, stdout contains `test`

4. CWD robustness (dot + spaces)
- Create temp dir with both patterns, e.g. `C:\Users\slemi\Documents\Codex Runner\D.ink test`
- Run all scenarios above with this cwd
- expect: exit `0`; command output references that cwd

5. Guardrail test (no batch host)
- Force resolver to return `.cmd` host in test
- expect: deterministic `UnsupportedShellHost` error (not `InvalidInput` from OS/Rust std)

Suggested Rust test skeleton:

```rust
#[test_case("powershell", true,  "echo test")]
#[test_case("powershell", false, "Get-Location; Get-ChildItem")]
#[test_case("cmd",        true,  "echo test")]
fn windows_exec_matrix(shell: &str, login: bool, command: &str) {
    // arrange cwd variants + execute + assert code/stdout/stderr
}
```

## Validation steps

1. Build patched runner binary.
2. Run matrix tests on Windows CI and local Windows machine.
3. In Codex Desktop, verify the previously failing repro commands in:
   - `C:\Users\slemi\Documents\D.ink`
   - a path containing spaces + dot
4. Confirm no log entries contain:
   - `exec error: batch file arguments are invalid`
5. Confirm shell startup still works for both:
   - login = true
   - login = false
6. Confirm fallback path uses `cmd.exe` (not `cmd.cmd`) by adding one debug log line at spawn time:
   - `resolved_shell_host=<absolute path>`

## Residual risks

- PowerShell profile/login semantics can vary; using `-NoProfile` only for `login=false` preserves intended behavior.
- If external plugins rely on `.cmd` wrappers, they may need migration guidance.
- PATH hijacks can still cause other executable-resolution surprises; prefer absolute paths for primary shell hosts.
- If command transport ever bypasses `-EncodedCommand`, quoting regressions can reappear.
