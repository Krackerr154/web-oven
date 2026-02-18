VPS NAT (1c/1GB)
Wireguard IP : 10.66.66.2

VPS Main (4C/8GB)
Wireguard IP : 10.66.66.1
Public IP : 103.197.189.138

Infrastructure :
Hosted at NAT VPS ----> Tunnel using NPM ----> Main VPS ----> Public Internet

Timezone policy:
- Booking system timezone: WIB (Asia/Jakarta)
- App runtime env: TZ=Asia/Jakarta
- Postgres client session hint: PGTZ=Asia/Jakarta
- Booking input/output shown in WIB, persisted as UTC instants