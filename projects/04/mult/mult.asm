// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Mult.asm

// Multiplies R0 and R1 and stores the result in R2.
// (R0, R1, R2 refer to RAM[0], RAM[1], and RAM[2], respectively.)

  // Put your code here.

  // init i, n and res
  @i
  M=0
  @R1
  D=M
  @n
  M=D
  
  @res
  M=0

(LOOP)
  // while i < ram[1]
  @n
  D=M
  @i
  D=D-M
  @RETURN
  D; JLE

  @res
  D=M
  @R0
  D=D+M
  @res
  M=D

  @i
  M=M+1
  
  @LOOP
  0;JMP

(RETURN)
  @res
  D=M
  @R2
  M=D

(END)
  @END
  0;JMP
  
