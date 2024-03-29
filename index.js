/*jslint long,name,node*/

(function () {

    const config = require("./config");
    const crypto = require("crypto");
    const express = require("express");
    const http = require("http");
    const socket = require("socket.io");

    let app = express();
    let clients = {};
    let server = http.createServer(app);
    let io = socket(server);

    function add(who, client) {
        let list = clients[who];

        if (!list) {
            list = [];
            clients[who] = list;
        }

        list.push(client);

        return who;
    }

    function notify(who, content) {
        let list = clients[who];

        if (Array.isArray(list)) {
            list.forEach(function (client) {
                client.emit(`:${content.type}`, content);
            });
        }
    }

    function remove(who, client) {
        let list = clients[who];

        if (list) {
            list = list.filter((element) => element !== client);

            if (list.length) {
                clients[who] = list;
            } else {
                delete clients[who];
            }
        }
    }

    app.get("/broadcast", function (request, response) {
        const exclude = request.query.exclude?.split(",");

        Object.keys(clients).forEach((id) => {
            if (!exclude || !exclude.includes(id)) {
                notify(id, request.query);
            }
        });

        response.send("");
    });

    app.get("/notify", function (request, response) {
        notify(request.query.id, request.query);

        response.send("");
    });

    io.on("connection", function (client) {
        let id;
        let who;

        while (true) {
            id = crypto.randomBytes(16).toString("hex");

            if (!clients[id]) {
                break;
            }
        }

        client.on("disconnect", function () {
            remove(who, client);

            delete clients[id];
        });

        client.on(":bind", function (data) {
            let tokens = data.token?.split("-");

            if (tokens?.length === 3 && Date.now() < tokens[1]) {
                let sha256 = crypto.createHash("sha256");

                sha256.update(`${tokens[0]}:${tokens[1]}:${config.secret}`);

                if (sha256.digest("hex").toUpperCase() === tokens[2]) {
                    remove(who, client);

                    who = add(tokens[0], client);

                    return;
                }
            }

            client.disconnect();
        });

        clients[id] = client;
    });

    server.listen(config.port);

}());
