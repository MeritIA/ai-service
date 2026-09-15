// Nest y class-validator guardan metadatos con Reflect; en la aplicacion lo carga
// Nest al arrancar, en las pruebas unitarias hay que cargarlo a mano.
import 'reflect-metadata';
