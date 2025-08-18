import { Box, Button, Card, CardDescription, For, Stack } from "@chakra-ui/react"
import ShinyText from './styling/ShinyText.js';
import GradientText from './styling/GradientText.js';
import Particles from './styling/Particles.js';
import { Provider } from "./ui/provider";
import React, { useState } from "react";

/*Place Order button at line 131*/

import { Clipboard, Link } from "@chakra-ui/react"
import {
    Field,
    Input,
    Popover,
    Portal,
} from "@chakra-ui/react"



var pack = [
    ["Basic Pack", 5, 800, 10, "Perfect for quick consultations—experience the magic of our transcriber.", ''],
    ["Pro Pack", 20, 3200, 38, "Ideal for concise, focused topic lectures.", <GradientText
        colors={["#ffffffff", "#737373ff", "#ffffffff", "#717171ff", "#ffffffff"]}
        animationSpeed={3}
        showBorder={false}
        className="custom-class"
    >
        <div style={{ fontSize: "1rem", fontWeight: "bold" }}>5% DISCOUNT!</div>
    </GradientText>],
    ["Mega Pack", 50, 8000, 90, "Boring class? Instantly turn it into an engaging one with our free summarization.", <GradientText
        colors={["#af9b00ff", "#ff0000ff", "#b3b600ff", "#fb0404ff", "#aa9c00ff"]}
        animationSpeed={3}
        showBorder={false}
        className="custom-class"
    >
        <div style={{ fontSize: "1rem", fontWeight: "bold" }}>10% DISCOUNT!</div>
    </GradientText>],
    ["Ultra Pack", 100, 16000, 170, "Effortlessly handle multiple lectures—your stress-free solution.", < GradientText
        colors=
        {["#6459fcff", "#54c8f9ff", "#48f745ff", "#ff5ab7ff", "#f3ff48ff"]}
        animationSpeed={3}
        showBorder={false}
        className="custom-class"
    >
        <div style={{ fontSize: "1rem", fontWeight: "bold" }}>15% DISCOUNT!</div>
    </GradientText >]
]

const PackagePage = () => {
    return (
        <>
            <Provider>
                <div style={{ width: '100%', height: '800px', position: 'relative', alignItems: 'center' }}>
                    <Particles
                        particleColors={['#ffffff', '#ffffff']}
                        particleCount={200}
                        particleSpread={10}
                        speed={0.1}
                        particleBaseSize={100}
                        moveParticlesOnHover={true}
                        alphaParticles={false}
                        disableRotation={false}
                    />
                </div >
                <div style={{ top: "0", position: "absolute", zIndex: 1, alignItems: "center", width: "100%", height: "100%" }}>
                    <GradientText
                        colors={["#ffffffff", "#737373ff", "#ffffffff", "#717171ff", "#ffffffff"]}
                        animationSpeed={3}
                        showBorder={false}
                        className="custom-class"
                    >
                        <div style={{ fontSize: "2.9rem", fontWeight: "bold", padding: "30px" }}>Buy your Package!</div>
                    </GradientText>
                    <Stack gap="4" direction="row" wrap="wrap" padding="4" justifyContent={"center"}>
                        <For each={pack}>
                            {(variant) => (
                                <Card.Root width="320px" variant={variant} key={variant} shadow="lg" borderRadius="lg" overflow="hidden">
                                    <Card.Body gap="2">
                                        <Card.Title mb="2" fontWeight={"bold"} fontSize={"1.5rem"}>{variant[0]}</Card.Title>
                                        <Card.Description>
                                            {variant[4]}
                                        </Card.Description>
                                        <Box display="inline-block" pos="relative"/*bg="bg" shadow="md" borderRadius="md" padding="2" mt="2" justifyItems={"center"}*/>
                                            <Card.Title>{variant[2]} Words - Price: {variant[3]}<span>&#2547;</span></Card.Title>
                                            <Card.Title>{variant[1]} minutes</Card.Title>
                                            <Card.Description>
                                                ~Per word {variant[3] / variant[1]}<span>&#2547;</span>
                                            </Card.Description>

                                        </Box>
                                    </Card.Body>
                                    <Card.Footer justifyContent="flex-end">
                                        {variant[5]}
                                        <Popover.Root>
                                            <Popover.Trigger asChild>
                                                <Button backgroundColor={"orange.700"} _hover={{ bg: "orange.600" }}><ShinyText text="Buy Now!" disabled={false} speed={1.7} className='custom-class' /></Button>
                                            </Popover.Trigger>
                                            <Portal>
                                                <Popover.Positioner>
                                                    <Popover.Content>
                                                        <Popover.Arrow />
                                                        <Popover.Body>
                                                            <Card.Title mb="2" fontWeight={"bold"} fontSize={"1.5rem"}>bKash payment:</Card.Title>
                                                            <Card.Description>
                                                                <br />
                                                                1. Open up the <span style={{ color: 'lightgrey', fontWeight: 'bold' }}> Bkash</span> app & choose <span className="danger">"Send Money"</span> (BE CAREFUL IT'S A PERSONAL ACCOUNT)<br />
                                                                2. Enter the <span style={{ color: 'lightgrey', fontWeight: 'bold' }}> Bkash</span>  Account Number, which is given below<br />
                                                                3. Enter the exact amount and confirm the transaction<br />
                                                                4. After sending money, you'll receive a <span style={{ color: 'lightgrey', fontWeight: 'bold' }}> Bkash</span>  Transaction ID (TRX ID). Also provide that below<br />
                                                                <span style={{ color: 'lightgreen', fontWeight: 'bold' }}>You need to send us: {variant[3]} TK</span><br />
                                                                Account type: PERSONAL<br />
                                                                <Clipboard.Root value="01700000000">
                                                                    <Clipboard.Trigger asChild>
                                                                        <Link as="span" color="blue.fg" textStyle="sm">
                                                                            <Card.Description>Account Number: </Card.Description>
                                                                            <Clipboard.Indicator />
                                                                            <Clipboard.ValueText />
                                                                        </Link>
                                                                    </Clipboard.Trigger>
                                                                </Clipboard.Root>
                                                            </Card.Description>
                                                            <Stack gap="4">
                                                                <Field.Root>
                                                                    <Field.Label>Your Bkash Account Number</Field.Label>
                                                                    <Input placeholder="01XXXXXXXXX" />
                                                                </Field.Root>
                                                                <Field.Root>
                                                                    <Field.Label>Bkash Transaction ID</Field.Label>
                                                                    <Input placeholder="Txn ID" />
                                                                </Field.Root>
                                                                <Button backgroundColor={"blue.600"} _hover={{ bg: "blue.500" }}><ShinyText text="Place Order" disabled={false} speed={1.7} className='custom-class' /></Button>
                                                            </Stack>
                                                        </Popover.Body>
                                                        <Popover.CloseTrigger />
                                                    </Popover.Content>
                                                </Popover.Positioner>
                                            </Portal>
                                        </Popover.Root>


                                    </Card.Footer>
                                </Card.Root>
                            )}
                        </For>
                    </Stack>

                </div>
            </Provider >
        </>
    )
}
export default PackagePage;
