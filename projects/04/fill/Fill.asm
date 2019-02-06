// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input.
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel;
// the screen should remain fully black as long as the key is pressed. 
// When no key is pressed, the program clears the screen, i.e. writes
// "white" in every pixel;
// the screen should remain fully clear as long as no key is pressed.

  // Put your code here.

  // color initializes to white
  @color
  M=0
  
  (LOOP)
  // get keyboard value
  @KBD
  D=M

  // determine if new color is white or black and handle accordingly
  @WHITE
  D;JEQ
  @BLACK
  0;JMP
  
  (WHITE)
  // if new color eq previous color, do nothing, else redraw
  @color
  D=M
  M=0
  @REDRAW
  D;JLT
  @LOOP
  0;JMP
  
  (BLACK)
  @color
  D=M
  M=-1
  @REDRAW
  D;JEQ
  @LOOP
  0;JMP

  (REDRAW)
  @color
  D=M

  @8191
  D=A
  @n
  M=D
  @c
  M=0

  (DRAW_LOOP)
  @n
  D=M
  @c
  D=D-M
  @LOOP
  D;JLE
  
  @c
  D=M
  @SCREEN
  D=A+D
  @offset
  M=D
  @color
  D=M
  @offset
  A=M
  M=D

  @c
  M=M+1
  
  @DRAW_LOOP
  0;JMP
