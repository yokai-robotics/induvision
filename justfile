set dotenv-load

web := "web"

default:
    @just --list

install:
    cd {{web}} && npm ci

setup: install catalog

catalog:
    cd {{web}} && npm run catalog:build

dev:
    cd {{web}} && npm run dev

build:
    cd {{web}} && npm run build

lint:
    cd {{web}} && npm run lint

test:
    cd {{web}} && npm test

start:
    cd {{web}} && npm run start
