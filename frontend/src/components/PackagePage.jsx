import { Box, Button, Card, CardDescription, Stack } from "@chakra-ui/react"
import ShinyText from './styling/ShinyText.jsx';
import GradientText from './styling/GradientText.jsx';
import Particles from './styling/Particles.jsx';
import { Provider } from "./ui/provider";
import React, { useState } from "react";
import './PackagePage.css'; // added CSS import
import { ToastContainer, toast } from "react-toastify";
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
    // add controlled popover state
    const [openIndex, setOpenIndex] = useState(null);

    // handle button click inside component so we can close popover
    async function handleButtonClick() {
        const n1El = document.getElementById('SenderBkashNumber');
        const n2El = document.getElementById('SenderBkashTxnID');

        const n1 = n1El ? n1El.value.trim() : '';
        const n2 = n2El ? n2El.value.trim() : '';

        if (!n1) {
            toast.error('Please enter your Bkash Account Number.');
            if (n1El) n1El.focus();
            return;
        }
        if (!n2) {
            toast.error('Please enter the Bkash Transaction ID.');
            if (n2El) n2El.focus();
            return;
        }

        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/send_button_click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ SenderBkashNumber: n1, SenderBkashTxnID: n2 })
            });
            if (!res.ok) throw new Error('Network response not ok');

            // on success: close popover, show success toast, clear inputs
            setOpenIndex(null);
            toast.success('Order placed');
            if (n1El) n1El.value = '';
            if (n2El) n2El.value = '';
        } catch (err) {
            toast.error('Failed to place order. Please try again.');
        }
    }

    return (
        <>
            <Provider>
                <ToastContainer position="top-right" autoClose={3000} />
                <div className="package-particles-container">
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
                <div className="package-overlay">
                    <GradientText
                        colors={["#ffffffff", "#737373ff", "#ffffffff", "#717171ff", "#ffffffff"]}
                        animationSpeed={3}
                        showBorder={false}
                        className="custom-class"
                    >
                        <div className="package-title">Buy your Package!</div>
                    </GradientText>
                    <Stack gap="4" direction="row" wrap="wrap" padding="4" justifyContent={"center"}>
                        {
                            // replace For with map to obtain index for controlled popover
                            pack.map((variant, idx) => (
                                <Card.Root width="320px" variant={variant} key={variant + idx} shadow="lg" borderRadius="lg" overflow="hidden">
                                    <Card.Body gap="2">
                                        <Card.Title mb="2" fontWeight={"bold"} fontSize={"1.5rem"}>{variant[0]}</Card.Title>
                                        <Card.Description>
                                            {variant[4]}
                                        </Card.Description>
                                        <Box className="package-info-box">
                                            <Card.Title>{variant[2]} Words - Price: {variant[3]}<span>&#2547;</span></Card.Title>
                                            <Card.Title>{variant[1]} minutes</Card.Title>
                                            <Card.Description>
                                                ~Per word {variant[3] / variant[1]}<span>&#2547;</span>
                                            </Card.Description>

                                        </Box>
                                    </Card.Body>
                                    <Card.Footer justifyContent="flex-end">
                                        {variant[5]}
                                        <Popover.Root
                                            // controlled popover for this card
                                            open={openIndex === idx}
                                            onOpenChange={(isOpen) => setOpenIndex(isOpen ? idx : null)}
                                        >
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
                                                                1. Open up the <span className="pkg-emphasis">Bkash</span> app & choose <span className="danger">"Send Money"</span> (BE CAREFUL IT'S A PERSONAL ACCOUNT)<br />
                                                                2. Enter the <span className="pkg-emphasis">Bkash</span>  Account Number, which is given below<br />
                                                                3. Enter the exact amount and confirm the transaction<br />
                                                                4. After sending money, you'll receive a <span className="pkg-emphasis">Bkash</span>  Transaction ID (TRX ID). Also provide that below<br />
                                                                <span className="pkg-highlight">You need to send us: {variant[3]} TK</span><br />
                                                                Account type: PERSONAL<br />
                                                                <Clipboard.Root value="01799937774">
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
                                                                    <Input placeholder="01XXXXXXXXX" id="SenderBkashNumber" required />
                                                                </Field.Root>
                                                                <Field.Root>
                                                                    <Field.Label>Bkash Transaction ID</Field.Label>
                                                                    <Input placeholder="Txn ID" id="SenderBkashTxnID"  required />
                                                                </Field.Root>

                                                                <Button backgroundColor={"blue.600"} _hover={{ bg: "blue.500" }} onClick={handleButtonClick}>
                                                                    <ShinyText text="Place Order" disabled={false} speed={1.7} className='custom-class' />
                                                                </Button>
                                                            </Stack>
                                                        </Popover.Body>
                                                        <Popover.CloseTrigger />
                                                    </Popover.Content>
                                                </Popover.Positioner>
                                            </Portal>
                                        </Popover.Root>


                                    </Card.Footer>
                                </Card.Root>
                            ))
                        }
                    </Stack>

                </div>
            </Provider >
        </>
    )
}
export default PackagePage;
