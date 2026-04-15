#!/bin/bash
set -e

PORT=27018
for arg in "$@"; do
  [ "$arg" = "--configsvr" ] && PORT=27019
done

echo "[$HOSTNAME] Starting mongod on port $PORT..."

"$@" --keyFile /etc/mongo/mongo.key &
MONGOD_PID=$!

echo "[$HOSTNAME] Waiting for mongod..."
until mongosh --host 127.0.0.1 --port $PORT \
  --eval 'db.runCommand({ping:1})' &>/dev/null; do
  sleep 1
done
echo "[$HOSTNAME] mongod ready."

if [ -n "$RS_INITIATE" ]; then
  echo "[$HOSTNAME] Initializing replicaset..."
  mongosh --host 127.0.0.1 --port $PORT --eval "
    try {
      var r = rs.initiate($RS_INITIATE);
      print('rs.initiate: ' + JSON.stringify(r));
    } catch(e) {
      if (e.code === 23) { print('Replicaset already initialized, OK.'); }
      else { throw e; }
    }
  "
  echo "[$HOSTNAME] Initialized replicaset."
fi




if [ "$PORT" = "27019" ] && [ -n "$RS_INITIATE" ]; then
  echo "[$HOSTNAME] Waiting for primaried to create admin..."
  until mongosh --quiet --host 127.0.0.1 --port $PORT --eval 'db.hello().isWritablePrimary' | grep -q 'true'; do
    sleep 1
  done

  echo "[$HOSTNAME] Creating root user using Localhost Exception..."
  mongosh --quiet --host 127.0.0.1 --port $PORT <<EOF
    use admin;
    try {
      db.createUser({
        user: "admin",
        pwd: "$MONGO_ADMIN_PASSWORD",
        roles: [{ role: "root", db: "admin" }]
      });
      print("Admin successfully created.");
    } catch(e) {
      print("Warning (user might already exist): " + e.message);
    }
EOF
fi

wait $MONGOD_PID