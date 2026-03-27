VPS NAT (4c/8GB)
Wireguard IP : 10.66.66.2

VPS Main (1C/1GB)
Wireguard IP : 10.66.66.1
Public IP : 103.197.189.138

Infrastructure :
Hosted at NAT VPS ----> Tunnel using NPM ----> Main VPS ----> Public Internet

Timezone policy:
- Booking system timezone: WIB (Asia/Jakarta)
- App runtime env: TZ=Asia/Jakarta
- Postgres client session hint: PGTZ=Asia/Jakarta
- Booking input/output shown in WIB, persisted as UTC instants

Now running docker instances :
CONTAINER ID   IMAGE                              COMMAND                  CREATED       STATUS       PORTS                                         NAMES
465fc72a0a32   ap-lab-dashboard-web-oven-ap-lab   "./docker-entrypoint…"   2 days ago    Up 2 days    0.0.0.0:3006->3000/tcp, [::]:3006->3000/tcp   web-oven-ap-lab
69ac24fa0de8   web-oven-web-oven                  "./docker-entrypoint…"   6 days ago    Up 6 days    0.0.0.0:3005->3000/tcp, [::]:3005->3000/tcp   web-oven
8f9ce6469af9   devlikeapro/waha                   "/usr/bin/tini -- /e…"   3 weeks ago   Up 3 weeks   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp   x01_waha
63a83762832b   postgres:15-alpine                 "docker-entrypoint.s…"   3 weeks ago   Up 3 weeks   0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp   x01_db
7f78f47aef71   pt-kit-backend-web                 "uvicorn app.main:ap…"   3 weeks ago   Up 3 weeks   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp   pt-kit-backend-web-1
24a0d84ba644   adminer                            "entrypoint.sh docke…"   3 weeks ago   Up 3 weeks   0.0.0.0:8081->8080/tcp, [::]:8081->8080/tcp   pt-kit-backend-adminer-1
3545ee28e221   postgres:13                        "docker-entrypoint.s…"   3 weeks ago   Up 3 weeks   0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp   pt-kit-backend-db-1
c1b3eca6713e   adminer                            "entrypoint.sh docke…"   6 weeks ago   Up 4 weeks   0.0.0.0:8080->8080/tcp, [::]:8080->8080/tcp   bot_adminer
95015ce93d4a   postgres:15-alpine                 "docker-entrypoint.s…"   6 weeks ago   Up 4 weeks   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp   bot_postgres
f02beb4b0782   n8nio/n8n:latest                   "tini -- /docker-ent…"   6 weeks ago   Up 4 weeks   0.0.0.0:5678->5678/tcp, [::]:5678->5678/tcp   n8n-docker-n8n-1