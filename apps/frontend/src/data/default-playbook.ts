export const DEFAULT_PLAYBOOK_CONTENT = `name: Bot-Mox Standard Provisioning
vars:
  vm_user: "User"
  power_plan: "high_performance"

pre_checks:
  - name: Check internet
    check: "Test-Connection 8.8.8.8 -Count 1 -Quiet"

roles:
  - role: base-system
    tags: [system]
    vars:
      disable_defender: true
      disable_windows_update: true

  - role: privacy-debloat
    tags: [privacy]

  - role: network-config
    tags: [network]

  - role: common-apps
    tags: [apps]
    vars:
      apps:
        - name: ".NET 8 SDK"
          file: "APP_SDKNET8.exe"
          args: "/install /quiet /norestart"
        - name: "WebView2"
          file: "APP_WebView2.exe"
          args: "/silent /install"
        - name: "Chrome"
          file: "APP_Chrome.exe"
          args: "/silent /install"
        - name: "Notepad++"
          file: "APP_Notepad.exe"
          args: "/S"
        - name: "WinRAR"
          file: "APP_WinRAR.exe"
          args: "/S"
        - name: "Syncthing"
          file: "APP_SyncThing.exe"
          args: "/silent /allusers"

  - role: personalization
    tags: [visual]

  - role: nvidia-driver
    tags: [drivers]
    when: "facts.gpu.vendor == 'NVIDIA'"

  - role: syncthing
    tags: [sync]

  - role: proxifier
    tags: [network]

  - role: post-reboot
    tags: [final]
`;
